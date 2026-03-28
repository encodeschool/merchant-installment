from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user, require_role
from ..models.user import User
from ..models.merchant import Merchant
from ..models.product import Product
from ..models.tariff import Tariff
from ..models.client import Client
from ..models.application import Application
from ..models.contract import Contract
from ..models.scoring import ScoringLog
from ..schemas.application import ApplicationCreate, DecisionRequest, ApplicationOut
from ..services.scoring import calculate_score, get_outcome, monthly_payment as calc_monthly_payment
from ..services.contract import generate_payment_schedule
from ..services.audit import log_action

router = APIRouter()


def _app_to_out(app: Application, db: Session) -> ApplicationOut:
    merchant = db.query(Merchant).filter(Merchant.id == app.merchant_id).first()
    client = db.query(Client).filter(Client.id == app.client_id).first()
    product = db.query(Product).filter(Product.id == app.product_id).first()
    tariff = db.query(Tariff).filter(Tariff.id == app.tariff_id).first()

    return ApplicationOut(
        id=app.id,
        merchantId=app.merchant_id,
        merchantName=merchant.name if merchant else "",
        clientName=client.full_name if client else "",
        clientPhone=client.phone if client else "",
        productName=product.name if product else "",
        productPrice=product.price if product else 0,
        tariffId=app.tariff_id,
        tariffName=tariff.name if tariff else "",
        months=app.months,
        monthlyPayment=app.monthly_payment,
        totalAmount=app.total_amount,
        score=app.score,
        status=app.status,
        approvedAmount=app.approved_amount,
        createdAt=app.created_at.isoformat(),
        decidedAt=app.decided_at.isoformat() if app.decided_at else None,
    )


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    body: ApplicationCreate,
    request: Request,
    current_user: User = Depends(require_role("MERCHANT")),
    db: Session = Depends(get_db),
):
    merchant = db.query(Merchant).filter(Merchant.id == body.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    product = db.query(Product).filter(Product.id == body.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.available:
        raise HTTPException(status_code=400, detail="Product is not available")

    tariff = db.query(Tariff).filter(Tariff.id == body.tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    if tariff.status != "APPROVED":
        raise HTTPException(status_code=400, detail="Tariff is not approved")

    if body.months not in {3, 6, 9, 12}:
        raise HTTPException(status_code=422, detail="Months must be one of 3, 6, 9, 12")
    if not (tariff.min_months <= body.months <= tariff.max_months):
        raise HTTPException(status_code=422, detail="Months out of tariff range")

    client = db.query(Client).filter(Client.passport_number == body.client.passport_number).first()
    if client:
        client.full_name = body.client.full_name
        client.phone = body.client.phone
        client.monthly_income = body.client.monthly_income
        client.age = body.client.age
        client.credit_history = body.client.credit_history
        db.commit()
    else:
        client = Client(
            full_name=body.client.full_name,
            passport_number=body.client.passport_number,
            phone=body.client.phone,
            monthly_income=body.client.monthly_income,
            age=body.client.age,
            credit_history=body.client.credit_history,
        )
        db.add(client)
        db.commit()
        db.refresh(client)

    down_payment = int(product.price * product.down_payment_percent / 100)
    financed_amount = product.price - down_payment

    mp = calc_monthly_payment(financed_amount, body.months, tariff.interest_rate)
    total = int(mp * body.months)

    score_breakdown = calculate_score(client.monthly_income, mp, client.age, client.credit_history)

    application = Application(
        merchant_id=body.merchant_id,
        client_id=client.id,
        product_id=body.product_id,
        tariff_id=body.tariff_id,
        months=body.months,
        monthly_payment=int(mp),
        total_amount=total,
        score=score_breakdown["total"],
        status="PENDING",
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    outcome = get_outcome(score_breakdown["total"], tariff.min_score)
    scoring_log = ScoringLog(
        application_id=application.id,
        client_id=client.id,
        income_score=score_breakdown["income_score"],
        credit_score=score_breakdown["credit_score"],
        age_score=score_breakdown["age_score"],
        tariff_score=score_breakdown["tariff_score"],
        total_score=score_breakdown["total"],
        outcome=outcome,
    )
    db.add(scoring_log)
    db.commit()

    log_action(db, current_user.id, "CREATE", "application", application.id, request.client.host if request.client else "")
    return _app_to_out(application, db)


@router.get("", response_model=list[ApplicationOut])
def list_applications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Application)
    if current_user.role == "MERCHANT":
        merchant = db.query(Merchant).filter(Merchant.name == current_user.organization).first()
        if merchant:
            query = query.filter(Application.merchant_id == merchant.id)
        else:
            return []
    apps = query.order_by(Application.created_at.desc()).all()
    return [_app_to_out(a, db) for a in apps]


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return _app_to_out(app, db)


@router.patch("/{application_id}/decide", response_model=ApplicationOut)
def decide_application(
    application_id: str,
    body: DecisionRequest,
    request: Request,
    current_user: User = Depends(require_role("MFO_ADMIN")),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.status != "PENDING":
        raise HTTPException(status_code=400, detail="Application is not in PENDING status")

    app.status = body.action
    app.decided_by = current_user.id
    app.decided_at = datetime.now(timezone.utc)

    if body.action in ("APPROVED", "PARTIAL"):
        if body.action == "PARTIAL":
            product = db.query(Product).filter(Product.id == app.product_id).first()
            down = int(product.price * product.down_payment_percent / 100) if product else 0
            financed = (product.price - down) if product else app.total_amount
            approved_amount = body.approved_amount if body.approved_amount else int(financed * 0.70)
            tariff = db.query(Tariff).filter(Tariff.id == app.tariff_id).first()
            mp = calc_monthly_payment(approved_amount, app.months, tariff.interest_rate if tariff else 0)
            app.monthly_payment = int(mp)
            app.total_amount = int(mp * app.months)
        else:
            approved_amount = body.approved_amount if body.approved_amount else app.total_amount
        app.approved_amount = approved_amount

        db.commit()
        db.refresh(app)

        contract = Contract(
            application_id=app.id,
            total_amount=app.total_amount,
            months=app.months,
            monthly_payment=app.monthly_payment,
            paid_installments=0,
            status="ACTIVE",
        )
        db.add(contract)
        db.commit()
        db.refresh(contract)

        schedule = generate_payment_schedule(
            contract.id,
            datetime.now(timezone.utc).date(),
            app.monthly_payment,
            app.months,
        )
        for inst in schedule:
            db.add(inst)
        db.commit()
    else:
        db.commit()
        db.refresh(app)

    log_action(db, current_user.id, f"DECIDE_{body.action}", "application", app.id, request.client.host if request.client else "")
    return _app_to_out(app, db)
