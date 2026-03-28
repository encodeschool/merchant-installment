from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user, require_role
from ..models.user import User
from ..models.tariff import Tariff
from ..schemas.tariff import TariffCreate, TariffUpdate, TariffOut
from ..services.audit import log_action

router = APIRouter()


def _tariff_to_out(tariff: Tariff, mfo_name: str) -> TariffOut:
    return TariffOut(
        id=tariff.id,
        name=tariff.name,
        mfoName=mfo_name,
        interestRate=tariff.interest_rate,
        minAmount=tariff.min_amount,
        maxAmount=tariff.max_amount,
        minMonths=tariff.min_months,
        maxMonths=tariff.max_months,
        minScore=tariff.min_score,
        status=tariff.status,
        createdAt=tariff.created_at.isoformat(),
        approvedAt=tariff.approved_at.isoformat() if tariff.approved_at else None,
    )


@router.post("", response_model=TariffOut, status_code=status.HTTP_201_CREATED)
def create_tariff(
    body: TariffCreate,
    request: Request,
    current_user: User = Depends(require_role("MFO_ADMIN")),
    db: Session = Depends(get_db),
):
    tariff = Tariff(
        name=body.name,
        mfo_user_id=current_user.id,
        interest_rate=body.interest_rate,
        min_amount=body.min_amount,
        max_amount=body.max_amount,
        min_months=body.min_months,
        max_months=body.max_months,
        min_score=body.min_score,
        status="PENDING",
    )
    db.add(tariff)
    db.commit()
    db.refresh(tariff)
    log_action(db, current_user.id, "CREATE", "tariff", tariff.id, request.client.host if request.client else "")
    return _tariff_to_out(tariff, current_user.organization)


@router.get("", response_model=list[TariffOut])
def list_tariffs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Tariff)
    if current_user.role == "MFO_ADMIN":
        query = query.filter(Tariff.mfo_user_id == current_user.id)

    tariffs = query.order_by(Tariff.created_at.desc()).all()
    result = []
    for t in tariffs:
        owner = db.query(User).filter(User.id == t.mfo_user_id).first()
        mfo_name = owner.organization if owner else ""
        result.append(_tariff_to_out(t, mfo_name))
    return result


@router.get("/{tariff_id}", response_model=TariffOut)
def get_tariff(
    tariff_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    owner = db.query(User).filter(User.id == tariff.mfo_user_id).first()
    return _tariff_to_out(tariff, owner.organization if owner else "")


@router.put("/{tariff_id}", response_model=TariffOut)
def update_tariff(
    tariff_id: str,
    body: TariffUpdate,
    request: Request,
    current_user: User = Depends(require_role("MFO_ADMIN")),
    db: Session = Depends(get_db),
):
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id, Tariff.mfo_user_id == current_user.id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    if tariff.status != "PENDING":
        raise HTTPException(status_code=400, detail="Only PENDING tariffs can be updated")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(tariff, field, value)
    db.commit()
    db.refresh(tariff)
    log_action(db, current_user.id, "UPDATE", "tariff", tariff.id, request.client.host if request.client else "")
    return _tariff_to_out(tariff, current_user.organization)


@router.delete("/{tariff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tariff(
    tariff_id: str,
    request: Request,
    current_user: User = Depends(require_role("MFO_ADMIN")),
    db: Session = Depends(get_db),
):
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id, Tariff.mfo_user_id == current_user.id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    if tariff.status == "APPROVED":
        raise HTTPException(status_code=400, detail="Approved tariffs cannot be deleted")
    log_action(db, current_user.id, "DELETE", "tariff", tariff.id, request.client.host if request.client else "")
    db.delete(tariff)
    db.commit()


@router.patch("/{tariff_id}/approve", response_model=TariffOut)
def approve_tariff(
    tariff_id: str,
    request: Request,
    current_user: User = Depends(require_role("CENTRAL_BANK")),
    db: Session = Depends(get_db),
):
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    tariff.status = "APPROVED"
    tariff.approved_at = datetime.now(timezone.utc)
    tariff.approved_by = current_user.id
    db.commit()
    db.refresh(tariff)
    log_action(db, current_user.id, "APPROVE", "tariff", tariff.id, request.client.host if request.client else "")
    owner = db.query(User).filter(User.id == tariff.mfo_user_id).first()
    return _tariff_to_out(tariff, owner.organization if owner else "")


@router.patch("/{tariff_id}/reject", response_model=TariffOut)
def reject_tariff(
    tariff_id: str,
    request: Request,
    current_user: User = Depends(require_role("CENTRAL_BANK")),
    db: Session = Depends(get_db),
):
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    tariff.status = "REJECTED"
    db.commit()
    db.refresh(tariff)
    log_action(db, current_user.id, "REJECT", "tariff", tariff.id, request.client.host if request.client else "")
    owner = db.query(User).filter(User.id == tariff.mfo_user_id).first()
    return _tariff_to_out(tariff, owner.organization if owner else "")
