from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from supabase import Client

from ..core.database import get_supabase
from ..core.deps import require_role

router = APIRouter()


def _monthly_trend(db: Client, mfo_user_id: str | None = None):
    now = datetime.now(timezone.utc)
    trend = []
    for offset in range(5, -1, -1):
        target = now - timedelta(days=30 * offset)
        year, month = target.year, target.month
        from_dt = datetime(year, month, 1, tzinfo=timezone.utc)
        next_month = month + 1 if month < 12 else 1
        next_year = year if month < 12 else year + 1
        to_dt = datetime(next_year, next_month, 1, tzinfo=timezone.utc)

        query = (
            db.table("applications").select("*", count="exact")
            .gte("created_at", from_dt.isoformat())
            .lt("created_at", to_dt.isoformat())
        )
        if mfo_user_id:
            merchant_ids = [
                m["id"] for m in
                db.table("merchants").select("id").eq("mfo_user_id", mfo_user_id).execute().data
            ]
            if merchant_ids:
                query = query.in_("merchant_id", merchant_ids)
            else:
                trend.append({"month": target.strftime("%b %Y"), "applications": 0})
                continue

        count = query.execute().count or 0
        trend.append({"month": target.strftime("%b %Y"), "applications": count})
    return trend


@router.get("/mfo")
def mfo_dashboard(
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    merchant_ids = [
        m["id"] for m in
        db.table("merchants").select("id").eq("mfo_user_id", current_user["id"]).execute().data
    ]
    total_merchants = len(merchant_ids)

    pending_apps = 0
    approved_this_month = 0
    total_turnover = 0
    unpaid_amount = 0
    if merchant_ids:
        pending_apps = (
            db.table("applications").select("*", count="exact")
            .in_("merchant_id", merchant_ids).eq("status", "PENDING")
            .execute().count or 0
        )
        now = datetime.now(timezone.utc)
        from_dt = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        approved_this_month = (
            db.table("applications").select("*", count="exact")
            .in_("merchant_id", merchant_ids)
            .in_("status", ["APPROVED", "PARTIAL"])
            .gte("decided_at", from_dt.isoformat())
            .execute().count or 0
        )
        app_ids = [
            a["id"] for a in
            db.table("applications").select("id").in_("merchant_id", merchant_ids).execute().data
        ]
        if app_ids:
            contracts = db.table("contracts").select("id, total_amount").in_("application_id", app_ids).execute().data
            total_turnover = sum(c["total_amount"] for c in contracts)
            contract_ids = [c["id"] for c in contracts]
            if contract_ids:
                unpaid_installments = (
                    db.table("installments").select("amount")
                    .in_("contract_id", contract_ids)
                    .in_("status", ["UPCOMING", "OVERDUE"])
                    .execute().data
                )
                unpaid_amount = sum(i["amount"] for i in unpaid_installments)

    return {
        "totalMerchants": total_merchants,
        "pendingApplications": pending_apps,
        "approvedThisMonth": approved_this_month,
        "totalTurnover": total_turnover,
        "unpaidAmount": unpaid_amount,
        "monthlyTrend": _monthly_trend(db, current_user["id"]),
    }


@router.get("/cb")
def cb_dashboard(
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    total_mfos = db.table("users").select("*", count="exact").eq("role", "MFO_ADMIN").execute().count or 0
    total_apps = db.table("applications").select("*", count="exact").execute().count or 0
    contracts = db.table("contracts").select("total_amount, status").execute().data
    total_disbursed = sum(c["total_amount"] for c in contracts)
    total_contracts = len(contracts)
    defaulted = sum(1 for c in contracts if c["status"] == "DEFAULTED")
    avg_default_rate = round(defaulted / total_contracts * 100, 2) if total_contracts > 0 else 0.0

    return {
        "totalMFOs": total_mfos,
        "totalApplications": total_apps,
        "totalDisbursed": total_disbursed,
        "avgDefaultRate": avg_default_rate,
        "monthlyTrend": _monthly_trend(db),
    }


@router.get("/mfo-list")
def mfo_list(
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    mfo_users = db.table("users").select("*").eq("role", "MFO_ADMIN").execute().data
    result = []
    for mfo in mfo_users:
        merchant_ids = [
            m["id"] for m in
            db.table("merchants").select("id").eq("mfo_user_id", mfo["id"]).execute().data
        ]
        total_apps = 0
        approved_apps = 0
        total_disbursed = 0
        total_contracts = 0
        defaulted_contracts = 0
        pending_tariffs = (
            db.table("tariffs").select("*", count="exact")
            .eq("mfo_user_id", mfo["id"]).eq("status", "PENDING")
            .execute().count or 0
        )
        if merchant_ids:
            total_apps = (
                db.table("applications").select("*", count="exact")
                .in_("merchant_id", merchant_ids).execute().count or 0
            )
            approved_apps = (
                db.table("applications").select("*", count="exact")
                .in_("merchant_id", merchant_ids)
                .in_("status", ["APPROVED", "PARTIAL", "ACTIVE", "COMPLETED"])
                .execute().count or 0
            )
            app_ids = [
                a["id"] for a in
                db.table("applications").select("id").in_("merchant_id", merchant_ids).execute().data
            ]
            if app_ids:
                contracts = db.table("contracts").select("total_amount, status").in_("application_id", app_ids).execute().data
                total_contracts = len(contracts)
                defaulted_contracts = sum(1 for c in contracts if c["status"] == "DEFAULTED")
                total_disbursed = sum(c["total_amount"] for c in contracts)

        approval_rate = round(approved_apps / total_apps * 100) if total_apps > 0 else 0
        default_rate = round(defaulted_contracts / total_contracts * 100, 2) if total_contracts > 0 else 0.0
        result.append({
            "id": mfo["id"],
            "name": mfo["organization"],
            "totalMerchants": len(merchant_ids),
            "totalApplications": total_apps,
            "approvalRate": approval_rate,
            "totalDisbursed": total_disbursed,
            "defaultRate": default_rate,
            "pendingTariffs": pending_tariffs,
            "status": "ACTIVE" if mfo["is_active"] else "SUSPENDED",
        })
    return result


@router.get("/audit-logs")
def audit_logs_list(
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    logs = db.table("audit_logs").select("*").order("created_at", desc=True).limit(500).execute().data
    user_cache: dict = {}
    result = []
    for log in logs:
        uid = log["user_id"]
        if uid not in user_cache:
            rows = db.table("users").select("name, role").eq("id", uid).execute().data
            user_cache[uid] = rows[0] if rows else None
        user = user_cache[uid]
        result.append({
            "id": log["id"],
            "userId": uid,
            "userName": user["name"] if user else "Unknown",
            "role": user["role"] if user else "UNKNOWN",
            "action": log["action"],
            "resource": log["resource"],
            "resourceId": log["resource_id"],
            "ipAddress": log["ip_address"],
            "timestamp": log["created_at"],
        })
    return result
