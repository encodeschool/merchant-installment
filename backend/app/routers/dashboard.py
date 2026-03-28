from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User
from app.models.merchant import Merchant
from app.models.application import Application
from app.models.contract import Contract
from app.models.tariff import Tariff

router = APIRouter()


def _monthly_trend(db: Session, mfo_user_id: str | None = None):
    now = datetime.now(timezone.utc)
    trend = []
    for offset in range(5, -1, -1):
        target = now - timedelta(days=30 * offset)
        year = target.year
        month = target.month
        query = db.query(func.count(Application.id)).filter(
            extract("year", Application.created_at) == year,
            extract("month", Application.created_at) == month,
        )
        if mfo_user_id:
            # Filter by applications whose merchant belongs to this MFO
            merchant_ids = [
                m.id for m in db.query(Merchant).filter(Merchant.mfo_user_id == mfo_user_id).all()
            ]
            query = query.filter(Application.merchant_id.in_(merchant_ids))
        count = query.scalar() or 0
        trend.append({"month": target.strftime("%b %Y"), "applications": count})
    return trend


@router.get("/mfo")
def mfo_dashboard(
    current_user: User = Depends(require_role("MFO_ADMIN")),
    db: Session = Depends(get_db),
):
    merchant_ids = [m.id for m in db.query(Merchant).filter(Merchant.mfo_user_id == current_user.id).all()]

    total_merchants = len(merchant_ids)
    pending_apps = (
        db.query(func.count(Application.id))
        .filter(Application.merchant_id.in_(merchant_ids), Application.status == "PENDING")
        .scalar() or 0
    )

    now = datetime.now(timezone.utc)
    approved_this_month = (
        db.query(func.count(Application.id))
        .filter(
            Application.merchant_id.in_(merchant_ids),
            Application.status.in_(["APPROVED", "PARTIAL"]),
            extract("year", Application.decided_at) == now.year,
            extract("month", Application.decided_at) == now.month,
        )
        .scalar() or 0
    )

    trend = _monthly_trend(db, current_user.id)

    return {
        "totalMerchants": total_merchants,
        "pendingApplications": pending_apps,
        "approvedThisMonth": approved_this_month,
        "monthlyTrend": trend,
    }


@router.get("/cb")
def cb_dashboard(
    current_user: User = Depends(require_role("CENTRAL_BANK")),
    db: Session = Depends(get_db),
):
    total_mfos = db.query(func.count(User.id)).filter(User.role == "MFO_ADMIN").scalar() or 0
    total_apps = db.query(func.count(Application.id)).scalar() or 0
    total_disbursed = db.query(func.coalesce(func.sum(Contract.total_amount), 0)).scalar() or 0

    total_contracts = db.query(func.count(Contract.id)).scalar() or 0
    defaulted = db.query(func.count(Contract.id)).filter(Contract.status == "DEFAULTED").scalar() or 0
    avg_default_rate = round((defaulted / total_contracts * 100), 2) if total_contracts > 0 else 0.0

    trend = _monthly_trend(db)

    return {
        "totalMFOs": total_mfos,
        "totalApplications": total_apps,
        "totalDisbursed": int(total_disbursed),
        "avgDefaultRate": avg_default_rate,
        "monthlyTrend": trend,
    }


@router.get("/mfo-list")
def mfo_list(
    current_user: User = Depends(require_role("CENTRAL_BANK")),
    db: Session = Depends(get_db),
):
    mfo_users = db.query(User).filter(User.role == "MFO_ADMIN").all()
    result = []
    for mfo in mfo_users:
        merchant_ids = [m.id for m in db.query(Merchant).filter(Merchant.mfo_user_id == mfo.id).all()]
        total_apps = (
            db.query(func.count(Application.id))
            .filter(Application.merchant_id.in_(merchant_ids))
            .scalar() or 0
        )
        approved_apps = (
            db.query(func.count(Application.id))
            .filter(Application.merchant_id.in_(merchant_ids), Application.status.in_(["APPROVED", "PARTIAL", "ACTIVE", "COMPLETED"]))
            .scalar() or 0
        )
        total_disbursed = (
            db.query(func.coalesce(func.sum(Contract.total_amount), 0))
            .join(Application, Application.id == Contract.application_id)
            .filter(Application.merchant_id.in_(merchant_ids))
            .scalar() or 0
        )
        pending_tariffs = (
            db.query(func.count(Tariff.id))
            .filter(Tariff.mfo_user_id == mfo.id, Tariff.status == "PENDING")
            .scalar() or 0
        )
        result.append({
            "id": mfo.id,
            "name": mfo.name,
            "organization": mfo.organization,
            "totalMerchants": len(merchant_ids),
            "totalApplications": total_apps,
            "approvedApplications": approved_apps,
            "totalDisbursed": int(total_disbursed),
            "pendingTariffs": pending_tariffs,
        })
    return result
