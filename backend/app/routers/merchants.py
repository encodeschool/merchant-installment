import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from supabase import Client

from ..core.database import get_supabase
from ..core.deps import get_current_user, require_role
from ..schemas.merchant import MerchantCreate, MerchantStatusUpdate, MerchantOut, MerchantStats
from ..services.audit import log_action

router = APIRouter()


def _merchant_to_out(m: dict, db: Client) -> MerchantOut:
    total = db.table("applications").select("*", count="exact").eq("merchant_id", m["id"]).execute().count or 0
    approved = (
        db.table("applications").select("*", count="exact")
        .eq("merchant_id", m["id"])
        .in_("status", ["APPROVED", "ACTIVE", "COMPLETED"])
        .execute().count or 0
    )
    return MerchantOut(
        id=m["id"],
        name=m["name"],
        legalName=m["legal_name"],
        category=m["category"],
        phone=m["phone"],
        address=m["address"],
        status=m["status"],
        totalApplications=total,
        approvedApplications=approved,
        joinedAt=m["created_at"],
    )


@router.post("", response_model=MerchantOut, status_code=status.HTTP_201_CREATED)
def create_merchant(
    body: MerchantCreate,
    request: Request,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    data = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "legal_name": body.legal_name,
        "category": body.category,
        "phone": body.phone,
        "address": body.address,
        "mfo_user_id": current_user["id"],
        "status": "PENDING",
    }
    merchant = db.table("merchants").insert(data).execute().data[0]
    log_action(db, current_user["id"], "CREATE", "merchant", merchant["id"], request.client.host if request.client else "")
    return _merchant_to_out(merchant, db)


@router.get("", response_model=list[MerchantOut])
def list_merchants(
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    merchants = (
        db.table("merchants").select("*")
        .eq("mfo_user_id", current_user["id"])
        .order("created_at", desc=True)
        .execute().data
    )
    return [_merchant_to_out(m, db) for m in merchants]


@router.get("/my", response_model=MerchantOut)
def get_my_merchant(
    current_user: dict = Depends(require_role("MERCHANT")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("merchants").select("*").eq("name", current_user["organization"]).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return _merchant_to_out(rows[0], db)


@router.get("/{merchant_id}", response_model=MerchantOut)
def get_merchant(
    merchant_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    rows = db.table("merchants").select("*").eq("id", merchant_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return _merchant_to_out(rows[0], db)


@router.patch("/{merchant_id}/status", response_model=MerchantOut)
def update_merchant_status(
    merchant_id: str,
    body: MerchantStatusUpdate,
    request: Request,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    if body.status not in ("ACTIVE", "SUSPENDED", "PENDING"):
        raise HTTPException(status_code=422, detail="Invalid status value")
    rows = db.table("merchants").select("*").eq("id", merchant_id).eq("mfo_user_id", current_user["id"]).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Merchant not found")
    merchant = db.table("merchants").update({"status": body.status}).eq("id", merchant_id).execute().data[0]
    log_action(db, current_user["id"], "STATUS_UPDATE", "merchant", merchant_id, request.client.host if request.client else "")
    return _merchant_to_out(merchant, db)


@router.get("/{merchant_id}/stats", response_model=MerchantStats)
def merchant_stats(
    merchant_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    rows = db.table("merchants").select("id").eq("id", merchant_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Merchant not found")

    total = db.table("applications").select("*", count="exact").eq("merchant_id", merchant_id).execute().count or 0
    approved = (
        db.table("applications").select("*", count="exact")
        .eq("merchant_id", merchant_id)
        .in_("status", ["APPROVED", "ACTIVE", "COMPLETED"])
        .execute().count or 0
    )
    contracts = (
        db.table("contracts").select("total_amount, applications!inner(merchant_id)")
        .eq("applications.merchant_id", merchant_id)
        .execute().data
    )
    disbursed = sum(c["total_amount"] for c in contracts)
    return MerchantStats(
        totalApplications=total,
        approvedApplications=approved,
        totalDisbursed=disbursed,
    )
