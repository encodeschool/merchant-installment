from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.merchant import Merchant
from ..models.application import Application
from ..models.client import Client
from ..models.product import Product
from ..models.contract import Contract, Installment
from ..schemas.contract import ContractOut, InstallmentOut
from ..services.contract import generate_pdf

router = APIRouter()


def _next_payment_date(installments: list) -> str | None:
    upcoming = [i for i in installments if i.status in ("UPCOMING", "OVERDUE")]
    if not upcoming:
        return None
    upcoming.sort(key=lambda i: i.due_date)
    return upcoming[0].due_date.isoformat()


def _contract_to_out(contract: Contract, db: Session) -> ContractOut:
    app = db.query(Application).filter(Application.id == contract.application_id).first()
    client = db.query(Client).filter(Client.id == app.client_id).first() if app else None
    merchant = db.query(Merchant).filter(Merchant.id == app.merchant_id).first() if app else None
    product = db.query(Product).filter(Product.id == app.product_id).first() if app else None
    installments = db.query(Installment).filter(Installment.contract_id == contract.id).all()

    return ContractOut(
        id=contract.id,
        applicationId=contract.application_id,
        clientName=client.full_name if client else "",
        merchantName=merchant.name if merchant else "",
        productName=product.name if product else "",
        totalAmount=contract.total_amount,
        months=contract.months,
        monthlyPayment=contract.monthly_payment,
        nextPaymentDate=_next_payment_date(installments),
        paidInstallments=contract.paid_installments,
        status=contract.status,
        createdAt=contract.created_at.isoformat(),
    )


@router.get("", response_model=list[ContractOut])
def list_contracts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "MERCHANT":
        merchant = db.query(Merchant).filter(Merchant.name == current_user.organization).first()
        if not merchant:
            return []
        app_ids = [a.id for a in db.query(Application).filter(Application.merchant_id == merchant.id).all()]
        contracts = db.query(Contract).filter(Contract.application_id.in_(app_ids)).all()
    else:
        contracts = db.query(Contract).all()
    return [_contract_to_out(c, db) for c in contracts]


@router.get("/{contract_id}", response_model=ContractOut)
def get_contract(
    contract_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return _contract_to_out(contract, db)


@router.get("/{contract_id}/schedule", response_model=list[InstallmentOut])
def get_schedule(
    contract_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    installments = (
        db.query(Installment)
        .filter(Installment.contract_id == contract_id)
        .order_by(Installment.installment_number)
        .all()
    )
    return [
        InstallmentOut(
            id=i.id,
            contractId=i.contract_id,
            installmentNumber=i.installment_number,
            dueDate=i.due_date.isoformat(),
            amount=i.amount,
            paidAt=i.paid_at.isoformat() if i.paid_at else None,
            status=i.status,
        )
        for i in installments
    ]


@router.get("/{contract_id}/pdf")
def get_contract_pdf(
    contract_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    app = db.query(Application).filter(Application.id == contract.application_id).first()
    client = db.query(Client).filter(Client.id == app.client_id).first() if app else None
    merchant = db.query(Merchant).filter(Merchant.id == app.merchant_id).first() if app else None
    product = db.query(Product).filter(Product.id == app.product_id).first() if app else None

    app._client_name = client.full_name if client else ""
    app._merchant_name = merchant.name if merchant else ""
    app._product_name = product.name if product else ""

    installments = (
        db.query(Installment)
        .filter(Installment.contract_id == contract_id)
        .order_by(Installment.installment_number)
        .all()
    )

    pdf_bytes = generate_pdf(contract, app, installments)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=contract-{contract_id}.pdf"},
    )
