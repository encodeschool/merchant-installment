from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from supabase import Client

from ..core.database import get_supabase
from ..core.deps import require_role
from ..services.forecast import build_forecast

router = APIRouter()


# ---------------------------------------------------------------------------
# DUMMY DATA MODE — real DB queries are commented out below each endpoint.
# To restore live data, remove the early `return` and uncomment the DB logic.
# ---------------------------------------------------------------------------


# def _monthly_trend(db: Client, mfo_user_id: str | None = None):
#     now = datetime.now(timezone.utc)
#     trend = []
#     for offset in range(5, -1, -1):
#         target = now - timedelta(days=30 * offset)
#         year, month = target.year, target.month
#         from_dt = datetime(year, month, 1, tzinfo=timezone.utc)
#         next_month = month + 1 if month < 12 else 1
#         next_year = year if month < 12 else year + 1
#         to_dt = datetime(next_year, next_month, 1, tzinfo=timezone.utc)
#
#         query = (
#             db.table("applications")
#             .select("*", count="exact")
#             .gte("created_at", from_dt.isoformat())
#             .lt("created_at", to_dt.isoformat())
#         )
#         if mfo_user_id:
#             merchant_ids = [
#                 m["id"]
#                 for m in db.table("merchants")
#                 .select("id")
#                 .eq("mfo_user_id", mfo_user_id)
#                 .execute()
#                 .data
#             ]
#             if merchant_ids:
#                 query = query.in_("merchant_id", merchant_ids)
#             else:
#                 trend.append({"month": target.strftime("%b %Y"), "applications": 0})
#                 continue
#
#         count = query.execute().count or 0
#         trend.append({"month": target.strftime("%b %Y"), "applications": count})
#     return trend


@router.get("/mfo")
def mfo_dashboard(
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    # --- DUMMY DATA ---
    return {
        "totalMerchants": 47,
        "pendingApplications": 13,
        "approvedThisMonth": 28,
        "totalTurnover": 1_845_600_000,
        "unpaidAmount": 312_400_000,
        "monthlyTrend": [
            {"month": "Oct 2025", "applications": 34},
            {"month": "Nov 2025", "applications": 41},
            {"month": "Dec 2025", "applications": 29},
            {"month": "Jan 2026", "applications": 52},
            {"month": "Feb 2026", "applications": 47},
            {"month": "Mar 2026", "applications": 61},
        ],
        "approvalRate": 74,
        "avgLoanAmount": 8_750_000,
        "activeContracts": 183,
        "overdueContracts": 11,
        "topMerchants": [
            {"name": "TechnoMart Tashkent", "applications": 38, "disbursed": 342_000_000},
            {"name": "MegaMall Samarkand",  "applications": 31, "disbursed": 278_500_000},
            {"name": "ElectroHub Fergana",   "applications": 24, "disbursed": 215_000_000},
            {"name": "HomeStyle Namangan",   "applications": 19, "disbursed": 167_300_000},
            {"name": "SportCity Bukhara",    "applications": 14, "disbursed": 98_700_000},
        ],
        "recentApplications": [
            {"id": "APP-2024", "merchant": "TechnoMart Tashkent", "amount": 12_500_000, "status": "PENDING",  "createdAt": "2026-03-29T08:14:00Z"},
            {"id": "APP-2023", "merchant": "MegaMall Samarkand",  "amount": 8_200_000,  "status": "APPROVED", "createdAt": "2026-03-28T15:47:00Z"},
            {"id": "APP-2022", "merchant": "ElectroHub Fergana",   "amount": 5_600_000,  "status": "APPROVED", "createdAt": "2026-03-28T11:30:00Z"},
            {"id": "APP-2021", "merchant": "HomeStyle Namangan",   "amount": 9_800_000,  "status": "REJECTED", "createdAt": "2026-03-27T09:05:00Z"},
            {"id": "APP-2020", "merchant": "SportCity Bukhara",    "amount": 3_150_000,  "status": "PENDING",  "createdAt": "2026-03-26T14:22:00Z"},
        ],
    }

    # --- REAL DB (commented out) ---
    # merchant_ids = [
    #     m["id"]
    #     for m in db.table("merchants")
    #     .select("id")
    #     .eq("mfo_user_id", current_user["id"])
    #     .execute()
    #     .data
    # ]
    # total_merchants = len(merchant_ids)
    #
    # pending_apps = 0
    # approved_this_month = 0
    # total_turnover = 0
    # unpaid_amount = 0
    # if merchant_ids:
    #     pending_apps = (
    #         db.table("applications")
    #         .select("*", count="exact")
    #         .in_("merchant_id", merchant_ids)
    #         .eq("status", "PENDING")
    #         .execute()
    #         .count
    #         or 0
    #     )
    #     now = datetime.now(timezone.utc)
    #     from_dt = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    #     approved_this_month = (
    #         db.table("applications")
    #         .select("*", count="exact")
    #         .in_("merchant_id", merchant_ids)
    #         .in_("status", ["APPROVED", "PARTIAL"])
    #         .gte("decided_at", from_dt.isoformat())
    #         .execute()
    #         .count
    #         or 0
    #     )
    #     app_ids = [
    #         a["id"]
    #         for a in db.table("applications")
    #         .select("id")
    #         .in_("merchant_id", merchant_ids)
    #         .execute()
    #         .data
    #     ]
    #     if app_ids:
    #         contracts = (
    #             db.table("contracts")
    #             .select("id, total_amount")
    #             .in_("application_id", app_ids)
    #             .execute()
    #             .data
    #         )
    #         total_turnover = sum(c["total_amount"] for c in contracts)
    #         contract_ids = [c["id"] for c in contracts]
    #         if contract_ids:
    #             unpaid_installments = (
    #                 db.table("installments")
    #                 .select("amount")
    #                 .in_("contract_id", contract_ids)
    #                 .in_("status", ["UPCOMING", "OVERDUE"])
    #                 .execute()
    #                 .data
    #             )
    #             unpaid_amount = sum(i["amount"] for i in unpaid_installments)
    #
    # return {
    #     "totalMerchants": total_merchants,
    #     "pendingApplications": pending_apps,
    #     "approvedThisMonth": approved_this_month,
    #     "totalTurnover": total_turnover,
    #     "unpaidAmount": unpaid_amount,
    #     "monthlyTrend": _monthly_trend(db, current_user["id"]),
    # }


@router.get("/cb")
def cb_dashboard(
    current_user: dict = Depends(require_role("CENTRAL_BANK")),
    db: Client = Depends(get_supabase),
):
    # --- DUMMY DATA ---
    return {
        "totalMFOs": 12,
        "totalApplications": 3_847,
        "totalDisbursed": 24_680_000_000,
        "avgDefaultRate": 3.2,
        "monthlyTrend": [
            {"month": "Oct 2025", "applications": 521},
            {"month": "Nov 2025", "applications": 489},
            {"month": "Dec 2025", "applications": 412},
            {"month": "Jan 2026", "applications": 638},
            {"month": "Feb 2026", "applications": 704},
            {"month": "Mar 2026", "applications": 761},
        ],
        "activeMFOs": 10,
        "suspendedMFOs": 2,
        "totalMerchants": 284,
        "totalActiveContracts": 2_103,
        "portfolioAtRisk": 5.7,
        "disbursementByRegion": [
            {"region": "Tashkent",   "amount": 8_420_000_000, "share": 34.1},
            {"region": "Samarkand",  "amount": 4_180_000_000, "share": 16.9},
            {"region": "Fergana",    "amount": 3_750_000_000, "share": 15.2},
            {"region": "Namangan",   "amount": 2_640_000_000, "share": 10.7},
            {"region": "Bukhara",    "amount": 2_210_000_000, "share": 9.0},
            {"region": "Other",      "amount": 3_480_000_000, "share": 14.1},
        ],
        "topMFOsByVolume": [
            {"name": "UzMicro Finance",   "disbursed": 6_340_000_000, "defaultRate": 2.1},
            {"name": "Agrobank MKO",      "disbursed": 5_120_000_000, "defaultRate": 1.8},
            {"name": "Hamkor MFO",        "disbursed": 4_870_000_000, "defaultRate": 3.5},
            {"name": "Ipoteka Credit",    "disbursed": 3_650_000_000, "defaultRate": 4.2},
            {"name": "MicroFin Plus",     "disbursed": 2_980_000_000, "defaultRate": 2.9},
        ],
    }

    # --- REAL DB (commented out) ---
    # total_mfos = (
    #     db.table("users")
    #     .select("*", count="exact")
    #     .eq("role", "MFO_ADMIN")
    #     .execute()
    #     .count
    #     or 0
    # )
    # total_apps = (
    #     db.table("applications").select("*", count="exact").execute().count or 0
    # )
    # contracts = db.table("contracts").select("total_amount, status").execute().data
    # total_disbursed = sum(c["total_amount"] for c in contracts)
    # total_contracts = len(contracts)
    # defaulted = sum(1 for c in contracts if c["status"] == "DEFAULTED")
    # avg_default_rate = (
    #     round(defaulted / total_contracts * 100, 2) if total_contracts > 0 else 0.0
    # )
    #
    # return {
    #     "totalMFOs": total_mfos,
    #     "totalApplications": total_apps,
    #     "totalDisbursed": total_disbursed,
    #     "avgDefaultRate": avg_default_rate,
    #     "monthlyTrend": _monthly_trend(db),
    # }


@router.get("/mfo-list")
def mfo_list(
    current_user: dict = Depends(require_role("CENTRAL_BANK")),
    db: Client = Depends(get_supabase),
):
    # --- DUMMY DATA ---
    return [
        {
            "id": "mfo-001",
            "name": "UzMicro Finance",
            "totalMerchants": 62,
            "totalApplications": 984,
            "approvalRate": 78,
            "totalDisbursed": 6_340_000_000,
            "defaultRate": 2.1,
            "pendingTariffs": 1,
            "status": "ACTIVE",
        },
        {
            "id": "mfo-002",
            "name": "Agrobank MKO",
            "totalMerchants": 54,
            "totalApplications": 821,
            "approvalRate": 82,
            "totalDisbursed": 5_120_000_000,
            "defaultRate": 1.8,
            "pendingTariffs": 0,
            "status": "ACTIVE",
        },
        {
            "id": "mfo-003",
            "name": "Hamkor MFO",
            "totalMerchants": 48,
            "totalApplications": 763,
            "approvalRate": 71,
            "totalDisbursed": 4_870_000_000,
            "defaultRate": 3.5,
            "pendingTariffs": 2,
            "status": "ACTIVE",
        },
        {
            "id": "mfo-004",
            "name": "Ipoteka Credit",
            "totalMerchants": 37,
            "totalApplications": 612,
            "approvalRate": 65,
            "totalDisbursed": 3_650_000_000,
            "defaultRate": 4.2,
            "pendingTariffs": 0,
            "status": "ACTIVE",
        },
        {
            "id": "mfo-005",
            "name": "MicroFin Plus",
            "totalMerchants": 31,
            "totalApplications": 487,
            "approvalRate": 69,
            "totalDisbursed": 2_980_000_000,
            "defaultRate": 2.9,
            "pendingTariffs": 3,
            "status": "ACTIVE",
        },
        {
            "id": "mfo-006",
            "name": "Kapital Bank MKO",
            "totalMerchants": 22,
            "totalApplications": 341,
            "approvalRate": 58,
            "totalDisbursed": 1_240_000_000,
            "defaultRate": 6.8,
            "pendingTariffs": 1,
            "status": "ACTIVE",
        },
        {
            "id": "mfo-007",
            "name": "Davr Finance",
            "totalMerchants": 18,
            "totalApplications": 214,
            "approvalRate": 44,
            "totalDisbursed": 620_000_000,
            "defaultRate": 11.3,
            "pendingTariffs": 0,
            "status": "SUSPENDED",
        },
        {
            "id": "mfo-008",
            "name": "Silk Road MFO",
            "totalMerchants": 12,
            "totalApplications": 156,
            "approvalRate": 37,
            "totalDisbursed": 390_000_000,
            "defaultRate": 14.7,
            "pendingTariffs": 2,
            "status": "SUSPENDED",
        },
    ]

    # --- REAL DB (commented out) ---
    # mfo_users = db.table("users").select("*").eq("role", "MFO_ADMIN").execute().data
    # result = []
    # for mfo in mfo_users:
    #     merchant_ids = [
    #         m["id"]
    #         for m in db.table("merchants")
    #         .select("id")
    #         .eq("mfo_user_id", mfo["id"])
    #         .execute()
    #         .data
    #     ]
    #     total_apps = 0
    #     approved_apps = 0
    #     total_disbursed = 0
    #     total_contracts = 0
    #     defaulted_contracts = 0
    #     pending_tariffs = (
    #         db.table("tariffs")
    #         .select("*", count="exact")
    #         .eq("mfo_user_id", mfo["id"])
    #         .eq("status", "PENDING")
    #         .execute()
    #         .count
    #         or 0
    #     )
    #     if merchant_ids:
    #         total_apps = (
    #             db.table("applications")
    #             .select("*", count="exact")
    #             .in_("merchant_id", merchant_ids)
    #             .execute()
    #             .count
    #             or 0
    #         )
    #         approved_apps = (
    #             db.table("applications")
    #             .select("*", count="exact")
    #             .in_("merchant_id", merchant_ids)
    #             .in_("status", ["APPROVED", "PARTIAL", "ACTIVE", "COMPLETED"])
    #             .execute()
    #             .count
    #             or 0
    #         )
    #         app_ids = [
    #             a["id"]
    #             for a in db.table("applications")
    #             .select("id")
    #             .in_("merchant_id", merchant_ids)
    #             .execute()
    #             .data
    #         ]
    #         if app_ids:
    #             contracts = (
    #                 db.table("contracts")
    #                 .select("total_amount, status")
    #                 .in_("application_id", app_ids)
    #                 .execute()
    #                 .data
    #             )
    #             total_contracts = len(contracts)
    #             defaulted_contracts = sum(
    #                 1 for c in contracts if c["status"] == "DEFAULTED"
    #             )
    #             total_disbursed = sum(c["total_amount"] for c in contracts)
    #
    #     approval_rate = round(approved_apps / total_apps * 100) if total_apps > 0 else 0
    #     default_rate = (
    #         round(defaulted_contracts / total_contracts * 100, 2)
    #         if total_contracts > 0
    #         else 0.0
    #     )
    #     result.append(
    #         {
    #             "id": mfo["id"],
    #             "name": mfo["organization"],
    #             "totalMerchants": len(merchant_ids),
    #             "totalApplications": total_apps,
    #             "approvalRate": approval_rate,
    #             "totalDisbursed": total_disbursed,
    #             "defaultRate": default_rate,
    #             "pendingTariffs": pending_tariffs,
    #             "status": "ACTIVE" if mfo["is_active"] else "SUSPENDED",
    #         }
    #     )
    # return result


@router.get("/audit-logs")
def audit_logs_list(
    current_user: dict = Depends(require_role("CENTRAL_BANK")),
    db: Client = Depends(get_supabase),
):
    logs = (
        db.table("audit_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(500)
        .execute()
        .data
    )
    user_cache: dict = {}
    result = []
    for log in logs:
        uid = log["user_id"]
        if uid not in user_cache:
            rows = db.table("users").select("name, role").eq("id", uid).execute().data
            user_cache[uid] = rows[0] if rows else None
        user = user_cache[uid]
        result.append(
            {
                "id": log["id"],
                "userId": uid,
                "userName": user["name"] if user else "Unknown",
                "role": user["role"] if user else "UNKNOWN",
                "action": log["action"],
                "resource": log["resource"],
                "resourceId": log["resource_id"],
                "ipAddress": log["ip_address"],
                "timestamp": log["created_at"],
            }
        )
    return result


@router.get("/mfo/forecast")
def mfo_revenue_forecast(
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    return build_forecast(
        db=db,
        mfo_user_id=current_user["id"],
        mfo_name=current_user.get("organization", "MFO"),
    )


@router.get("/mfo/forecast/debug")
def mfo_forecast_debug(
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    """Debug endpoint: returns raw data used for forecast (no caching)."""
    from ..services.forecast import ForecastService
    svc = ForecastService(db, current_user["id"], current_user.get("organization", "MFO"))
    merchant_ids = svc.merchant_ids
    history = svc.collect_monthly_history()
    pipeline = svc.collect_pending_pipeline()
    tariffs = svc.collect_active_tariffs()

    # Sample raw applications for first merchant
    sample_apps = []
    if merchant_ids:
        sample_apps = (
            db.table("applications")
            .select("id, status, approved_amount, total_amount, created_at")
            .in_("merchant_id", merchant_ids)
            .limit(5)
            .execute()
            .data
        )

    return {
        "mfo_user_id": current_user["id"],
        "merchant_ids": merchant_ids,
        "monthly_history": history,
        "pipeline": pipeline,
        "tariffs_count": len(tariffs),
        "sample_apps": sample_apps,
    }
