import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from supabase import Client

from ..core.database import get_supabase
from ..core.deps import get_current_user, require_role
from ..schemas.application import ApplicationCreate, DecisionRequest, ApplicationOut
from ..services.scoring import calculate_score, get_outcome, monthly_payment as calc_monthly_payment
from ..services.contract import generate_payment_schedule
from ..services.audit import log_action

router = APIRouter()


def _app_to_out(app: dict, db: Client) -> ApplicationOut:
    merchant = db.table("merchants").select("name").eq("id", app["merchant_id"]).execute().data
    client = db.table("clients").select("full_name, phone").eq("id", app["client_id"]).execute().data
    product = db.table("products").select("name, price").eq("id", app["product_id"]).execute().data
    tariff = db.table("tariffs").select("name").eq("id", app["tariff_id"]).execute().data

    return ApplicationOut(
        id=app["id"],
        merchantId=app["merchant_id"],
        merchantName=merchant[0]["name"] if merchant else "",
        clientName=client[0]["full_name"] if client else "",
        clientPhone=client[0]["phone"] if client else "",
        productName=product[0]["name"] if product else "",
        productPrice=product[0]["price"] if product else 0,
        tariffId=app["tariff_id"],
        tariffName=tariff[0]["name"] if tariff else "",
        months=app["months"],
        monthlyPayment=app["monthly_payment"],
        totalAmount=app["total_amount"],
        score=app["score"],
        status=app["status"],
        approvedAmount=app.get("approved_amount"),
        createdAt=app["created_at"],
        decidedAt=app.get("decided_at"),
    )


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    body: ApplicationCreate,
    request: Request,
    current_user: dict = Depends(require_role("MERCHANT")),
    db: Client = Depends(get_supabase),
):
    merchant_rows = db.table("merchants").select("*").eq("id", body.merchant_id).execute().data
    if not merchant_rows:
        raise HTTPException(status_code=404, detail="Merchant not found")

    product_rows = db.table("products").select("*").eq("id", body.product_id).execute().data
    if not product_rows:
        raise HTTPException(status_code=404, detail="Product not found")
    product = product_rows[0]
    if not product["available"]:
        raise HTTPException(status_code=400, detail="Product is not available")

    tariff_rows = db.table("tariffs").select("*").eq("id", body.tariff_id).execute().data
    if not tariff_rows:
        raise HTTPException(status_code=404, detail="Tariff not found")
    tariff = tariff_rows[0]
    if tariff["status"] != "APPROVED":
        raise HTTPException(status_code=400, detail="Tariff is not approved")

    if body.months not in {3, 6, 9, 12}:
        raise HTTPException(status_code=422, detail="Months must be one of 3, 6, 9, 12")
    if not (tariff["min_months"] <= body.months <= tariff["max_months"]):
        raise HTTPException(status_code=422, detail="Months out of tariff range")

    existing_client = db.table("clients").select("*").eq("passport_number", body.client.passport_number).execute().data
    if existing_client:
        client_id = existing_client[0]["id"]
        db.table("clients").update({
            "full_name": body.client.full_name,
            "phone": body.client.phone,
            "monthly_income": body.client.monthly_income,
            "age": body.client.age,
            "credit_history": body.client.credit_history,
        }).eq("id", client_id).execute()
        client = db.table("clients").select("*").eq("id", client_id).execute().data[0]
    else:
        client_data = {
            "id": str(uuid.uuid4()),
            "full_name": body.client.full_name,
            "passport_number": body.client.passport_number,
            "phone": body.client.phone,
            "monthly_income": body.client.monthly_income,
            "age": body.client.age,
            "credit_history": body.client.credit_history,
        }
        client = db.table("clients").insert(client_data).execute().data[0]

    down_payment = int(product["price"] * product["down_payment_percent"] / 100)
    financed_amount = product["price"] - down_payment
    mp = calc_monthly_payment(financed_amount, body.months, tariff["interest_rate"])
    total = int(mp * body.months)
    score_breakdown = calculate_score(client["monthly_income"], mp, client["age"], client["credit_history"])

    app_data = {
        "id": str(uuid.uuid4()),
        "merchant_id": body.merchant_id,
        "client_id": client["id"],
        "product_id": body.product_id,
        "tariff_id": body.tariff_id,
        "months": body.months,
        "monthly_payment": int(mp),
        "total_amount": total,
        "score": score_breakdown["total"],
        "status": "PENDING",
    }
    application = db.table("applications").insert(app_data).execute().data[0]

    outcome = get_outcome(score_breakdown["total"], tariff["min_score"])
    db.table("scoring_logs").insert({
        "id": str(uuid.uuid4()),
        "application_id": application["id"],
        "client_id": client["id"],
        "income_score": score_breakdown["income_score"],
        "credit_score": score_breakdown["credit_score"],
        "age_score": score_breakdown["age_score"],
        "tariff_score": score_breakdown["tariff_score"],
        "total_score": score_breakdown["total"],
        "outcome": outcome,
    }).execute()

    log_action(db, current_user["id"], "CREATE", "application", application["id"], request.client.host if request.client else "")
    return _app_to_out(application, db)


@router.get("", response_model=list[ApplicationOut])
def list_applications(
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    if current_user["role"] == "MERCHANT":
        merchants = db.table("merchants").select("id").eq("name", current_user["organization"]).execute().data
        if not merchants:
            return []
        apps = db.table("applications").select("*").eq("merchant_id", merchants[0]["id"]).order("created_at", desc=True).execute().data
    else:
        apps = db.table("applications").select("*").order("created_at", desc=True).execute().data
    return [_app_to_out(a, db) for a in apps]


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    rows = db.table("applications").select("*").eq("id", application_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Application not found")
    return _app_to_out(rows[0], db)


@router.patch("/{application_id}/decide", response_model=ApplicationOut)
def decide_application(
    application_id: str,
    body: DecisionRequest,
    request: Request,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("applications").select("*").eq("id", application_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Application not found")
    app = rows[0]
    if app["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Application is not in PENDING status")

    updates = {
        "status": body.action,
        "decided_by": current_user["id"],
        "decided_at": datetime.now(timezone.utc).isoformat(),
    }

    if body.action in ("APPROVED", "PARTIAL"):
        product_rows = db.table("products").select("*").eq("id", app["product_id"]).execute().data
        product = product_rows[0] if product_rows else {}
        tariff_rows = db.table("tariffs").select("*").eq("id", app["tariff_id"]).execute().data
        tariff = tariff_rows[0] if tariff_rows else {}

        if body.action == "PARTIAL":
            down = int(product.get("price", 0) * product.get("down_payment_percent", 0) / 100)
            financed = product.get("price", 0) - down
            approved_amount = body.approved_amount if body.approved_amount else int(financed * 0.70)
            mp = calc_monthly_payment(approved_amount, app["months"], tariff.get("interest_rate", 0))
            updates["monthly_payment"] = int(mp)
            updates["total_amount"] = int(mp * app["months"])
        else:
            approved_amount = body.approved_amount if body.approved_amount else app["total_amount"]
        updates["approved_amount"] = approved_amount

    application = db.table("applications").update(updates).eq("id", application_id).execute().data[0]

    if body.action in ("APPROVED", "PARTIAL"):
        contract_data = {
            "id": str(uuid.uuid4()),
            "application_id": application["id"],
            "total_amount": application["total_amount"],
            "months": application["months"],
            "monthly_payment": application["monthly_payment"],
            "paid_installments": 0,
            "status": "ACTIVE",
        }
        contract = db.table("contracts").insert(contract_data).execute().data[0]

        schedule = generate_payment_schedule(
            contract["id"],
            datetime.now(timezone.utc).date(),
            application["monthly_payment"],
            application["months"],
        )
        db.table("installments").insert(schedule).execute()

    log_action(db, current_user["id"], f"DECIDE_{body.action}", "application", application_id, request.client.host if request.client else "")
    return _app_to_out(application, db)
