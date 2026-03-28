from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..core.database import get_db
from ..core.deps import get_current_user, require_role
from ..models.user import User
from ..models.merchant import Merchant
from ..models.application import Application
from ..models.contract import Contract
from ..schemas.merchant import MerchantCreate, MerchantUpdate, MerchantStatusUpdate, MerchantOut, MerchantStats
from ..services.audit import log_action

router = APIRouter()


def _merchant_to_out(merchant: Merchant, db: Session) -> MerchantOut:
    total = db.query(func.count(Application.id)).filter(Application.merchant_id == merchant.id).scalar() or 0
    approved = (
        db.query(func.count(Application.id))
        .filter(Application.merchant_id == merchant.id, Application.status.in_(["APPROVED", "ACTIVE", "COMPLETED"]))
        .scalar() or 0
    )
    return MerchantOut(
        id=merchant.id,
        name=merchant.name,
        legalName=merchant.legal_name,
        category=merchant.category,
        phone=merchant.phone,
        address=merchant.address,
        status=merchant.status,
        totalApplications=total,
        approvedApplications=approved,
        joinedAt=merchant.created_at.isoformat(),
    )


@router.post("", response_model=MerchantOut, status_code=status.HTTP_201_CREATED)
def create_merchant(
    body: MerchantCreate,
    request: Request,
    current_user: User = Depends(require_role("MFO_ADMIN")),
    db: Session = Depends(get_db),
):
    merchant = Merchant(
        name=body.name,
        legal_name=body.legal_name,
        category=body.category,
        phone=body.phone,
        address=body.address,
        mfo_user_id=current_user.id,
        status="PENDING",
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)
    log_action(db, current_user.id, "CREATE", "merchant", merchant.id, request.client.host if request.client else "")
    return _merchant_to_out(merchant, db)


@router.get("", response_model=list[MerchantOut])
def list_merchants(
    current_user: User = Depends(require_role("MFO_ADMIN", "CENTRAL_BANK")),
    db: Session = Depends(get_db),
):
    query = db.query(Merchant)
    if current_user.role == "MFO_ADMIN":
        query = query.filter(Merchant.mfo_user_id == current_user.id)
    merchants = query.order_by(Merchant.created_at.desc()).all()
    return [_merchant_to_out(m, db) for m in merchants]


@router.get("/my", response_model=MerchantOut)
def get_my_merchant(
    current_user: User = Depends(require_role("MERCHANT")),
    db: Session = Depends(get_db),
):
    merchant = db.query(Merchant).filter(Merchant.name == current_user.organization).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return _merchant_to_out(merchant, db)


@router.get("/{merchant_id}", response_model=MerchantOut)
def get_merchant(
    merchant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return _merchant_to_out(merchant, db)


@router.patch("/{merchant_id}/status", response_model=MerchantOut)
def update_merchant_status(
    merchant_id: str,
    body: MerchantStatusUpdate,
    request: Request,
    current_user: User = Depends(require_role("MFO_ADMIN")),
    db: Session = Depends(get_db),
):
    if body.status not in ("ACTIVE", "SUSPENDED", "PENDING"):
        raise HTTPException(status_code=422, detail="Invalid status value")
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id, Merchant.mfo_user_id == current_user.id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    merchant.status = body.status
    db.commit()
    db.refresh(merchant)
    log_action(db, current_user.id, "STATUS_UPDATE", "merchant", merchant.id, request.client.host if request.client else "")
    return _merchant_to_out(merchant, db)


@router.get("/{merchant_id}/stats", response_model=MerchantStats)
def merchant_stats(
    merchant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    total = db.query(func.count(Application.id)).filter(Application.merchant_id == merchant_id).scalar() or 0
    approved = (
        db.query(func.count(Application.id))
        .filter(Application.merchant_id == merchant_id, Application.status.in_(["APPROVED", "ACTIVE", "COMPLETED"]))
        .scalar() or 0
    )
    disbursed = (
        db.query(func.coalesce(func.sum(Contract.total_amount), 0))
        .join(Application, Application.id == Contract.application_id)
        .filter(Application.merchant_id == merchant_id)
        .scalar() or 0
    )
    return MerchantStats(
        totalApplications=total,
        approvedApplications=approved,
        totalDisbursed=int(disbursed),
    )
