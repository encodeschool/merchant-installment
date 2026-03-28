import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from supabase import Client

from ..core.database import get_supabase
from ..core.deps import get_current_user, require_role
from ..schemas.tariff import TariffCreate, TariffUpdate, TariffOut, ScoringConfigUpdate, ScoringConfigOut
from ..services.audit import log_action

router = APIRouter()


def _tariff_to_out(t: dict, mfo_name: str) -> TariffOut:
    return TariffOut(
        id=t["id"],
        name=t["name"],
        mfoName=mfo_name,
        interestRate=t["interest_rate"],
        minAmount=t["min_amount"],
        maxAmount=t["max_amount"],
        minMonths=t["min_months"],
        maxMonths=t["max_months"],
        minScore=t["min_score"],
        status=t["status"],
        createdAt=t["created_at"],
        approvedAt=t.get("approved_at"),
    )


@router.post("", response_model=TariffOut, status_code=status.HTTP_201_CREATED)
def create_tariff(
    body: TariffCreate,
    request: Request,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    data = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "mfo_user_id": current_user["id"],
        "interest_rate": body.interest_rate,
        "min_amount": body.min_amount,
        "max_amount": body.max_amount,
        "min_months": body.min_months,
        "max_months": body.max_months,
        "min_score": body.min_score,
        "status": "PENDING",
    }
    tariff = db.table("tariffs").insert(data).execute().data[0]
    log_action(db, current_user["id"], "CREATE", "tariff", tariff["id"], request.client.host if request.client else "")
    return _tariff_to_out(tariff, current_user["organization"])


@router.get("", response_model=list[TariffOut])
def list_tariffs(
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    query = db.table("tariffs").select("*").order("created_at", desc=True)
    if current_user["role"] == "MFO_ADMIN":
        query = query.eq("mfo_user_id", current_user["id"])
    tariffs = query.execute().data

    result = []
    for t in tariffs:
        owner = db.table("users").select("organization").eq("id", t["mfo_user_id"]).execute().data
        mfo_name = owner[0]["organization"] if owner else ""
        result.append(_tariff_to_out(t, mfo_name))
    return result


@router.get("/{tariff_id}", response_model=TariffOut)
def get_tariff(
    tariff_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    rows = db.table("tariffs").select("*").eq("id", tariff_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Tariff not found")
    t = rows[0]
    owner = db.table("users").select("organization").eq("id", t["mfo_user_id"]).execute().data
    mfo_name = owner[0]["organization"] if owner else ""
    return _tariff_to_out(t, mfo_name)


@router.put("/{tariff_id}", response_model=TariffOut)
def update_tariff(
    tariff_id: str,
    body: TariffUpdate,
    request: Request,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("tariffs").select("*").eq("id", tariff_id).eq("mfo_user_id", current_user["id"]).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Tariff not found")
    if rows[0]["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Only PENDING tariffs can be updated")

    updates = body.model_dump(exclude_none=True)
    tariff = db.table("tariffs").update(updates).eq("id", tariff_id).execute().data[0]
    log_action(db, current_user["id"], "UPDATE", "tariff", tariff_id, request.client.host if request.client else "")
    return _tariff_to_out(tariff, current_user["organization"])


@router.delete("/{tariff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tariff(
    tariff_id: str,
    request: Request,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("tariffs").select("*").eq("id", tariff_id).eq("mfo_user_id", current_user["id"]).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Tariff not found")
    if rows[0]["status"] == "APPROVED":
        raise HTTPException(status_code=400, detail="Approved tariffs cannot be deleted")
    log_action(db, current_user["id"], "DELETE", "tariff", tariff_id, request.client.host if request.client else "")
    db.table("tariffs").delete().eq("id", tariff_id).execute()


@router.get("/{tariff_id}/scoring-config", response_model=ScoringConfigOut)
def get_scoring_config(
    tariff_id: str,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("tariffs").select("*").eq("id", tariff_id).eq("mfo_user_id", current_user["id"]).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Tariff not found")
    t = rows[0]
    return ScoringConfigOut(
        w_affordability=t["w_affordability"],
        w_credit_history=t["w_credit_history"],
        w_behavioral=t["w_behavioral"],
        w_demographic=t["w_demographic"],
        min_score=t["min_score"],
        partial_threshold=t["partial_threshold"],
        partial_ratio=t["partial_ratio"],
        hard_dti_min=t["hard_dti_min"],
        max_open_loans=t["max_open_loans"],
        max_overdue_days=t["max_overdue_days"],
        bankruptcy_reject=t["bankruptcy_reject"],
    )


@router.patch("/{tariff_id}/scoring-config", response_model=ScoringConfigOut)
def update_scoring_config(
    tariff_id: str,
    body: ScoringConfigUpdate,
    request: Request,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("tariffs").select("*").eq("id", tariff_id).eq("mfo_user_id", current_user["id"]).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Tariff not found")
    t = rows[0]
    if t["status"] == "APPROVED":
        raise HTTPException(status_code=400, detail="Cannot update scoring config of an APPROVED tariff")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields provided")

    # Cross-field validation: partial_threshold < min_score (using merged values)
    effective_min_score = updates.get("min_score", t["min_score"])
    effective_partial_threshold = updates.get("partial_threshold", t["partial_threshold"])
    if effective_partial_threshold >= effective_min_score:
        raise HTTPException(
            status_code=422,
            detail=f"partial_threshold ({effective_partial_threshold}) must be less than min_score ({effective_min_score})",
        )

    updated = db.table("tariffs").update(updates).eq("id", tariff_id).execute().data[0]
    log_action(db, current_user["id"], "UPDATE_SCORING_CONFIG", "tariff", tariff_id, request.client.host if request.client else "")
    return ScoringConfigOut(
        w_affordability=updated["w_affordability"],
        w_credit_history=updated["w_credit_history"],
        w_behavioral=updated["w_behavioral"],
        w_demographic=updated["w_demographic"],
        min_score=updated["min_score"],
        partial_threshold=updated["partial_threshold"],
        partial_ratio=updated["partial_ratio"],
        hard_dti_min=updated["hard_dti_min"],
        max_open_loans=updated["max_open_loans"],
        max_overdue_days=updated["max_overdue_days"],
        bankruptcy_reject=updated["bankruptcy_reject"],
    )


@router.patch("/{tariff_id}/approve", response_model=TariffOut)
def approve_tariff(
    tariff_id: str,
    request: Request,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("tariffs").select("*").eq("id", tariff_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Tariff not found")
    tariff = db.table("tariffs").update({
        "status": "APPROVED",
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": current_user["id"],
    }).eq("id", tariff_id).execute().data[0]
    log_action(db, current_user["id"], "APPROVE", "tariff", tariff_id, request.client.host if request.client else "")
    owner = db.table("users").select("organization").eq("id", tariff["mfo_user_id"]).execute().data
    return _tariff_to_out(tariff, owner[0]["organization"] if owner else "")


@router.patch("/{tariff_id}/reject", response_model=TariffOut)
def reject_tariff(
    tariff_id: str,
    request: Request,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    rows = db.table("tariffs").select("*").eq("id", tariff_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Tariff not found")
    tariff = db.table("tariffs").update({"status": "REJECTED"}).eq("id", tariff_id).execute().data[0]
    log_action(db, current_user["id"], "REJECT", "tariff", tariff_id, request.client.host if request.client else "")
    owner = db.table("users").select("organization").eq("id", tariff["mfo_user_id"]).execute().data
    return _tariff_to_out(tariff, owner[0]["organization"] if owner else "")
