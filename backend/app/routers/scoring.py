from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from pydantic import BaseModel
from typing import Optional

from ..core.database import get_supabase
from ..core.deps import get_current_user, require_role
from ..services.scoring import calculate_score_full

router = APIRouter()

# Defaults used when no tariff and no overrides are provided
_DEFAULTS = {
    "w_affordability": 0.4,
    "w_credit": 0.3,
    "w_behavioral": 0.2,
    "w_demographic": 0.1,
    "min_score": 70,
    "partial_threshold": 50,
    "partial_ratio": 0.7,
    "hard_dti_min": 1.5,
    "max_open_loans": 5,
    "max_overdue_days": 90,
    "bankruptcy_reject": True,
}


class ScoreCalculateRequest(BaseModel):
    # Optional tariff source
    tariff_id: Optional[str] = None
    # Client data
    monthly_income: int
    monthly_payment: float
    age: int
    credit_history: str
    open_loans: int = 0
    overdue_days: int = 0
    has_bankruptcy: bool = False
    # Inline overrides — take precedence over tariff DB values (live preview)
    w_affordability: Optional[float] = None
    w_credit: Optional[float] = None
    w_behavioral: Optional[float] = None
    w_demographic: Optional[float] = None
    min_score: Optional[int] = None
    partial_threshold: Optional[int] = None
    partial_ratio: Optional[float] = None
    hard_dti_min: Optional[float] = None
    max_open_loans: Optional[int] = None
    max_overdue_days: Optional[int] = None
    bankruptcy_reject: Optional[bool] = None


class ScoreCalculateResponse(BaseModel):
    hard_reject: bool
    hard_reject_reason: Optional[str]
    f1_affordability: int
    f2_credit: int
    f3_behavioral: int
    f4_demographic: int
    weights: dict
    total_score: int
    decision: str
    approved_ratio: float
    reason_codes: list[str]


@router.post("/calculate", response_model=ScoreCalculateResponse)
def score_calculate(
    body: ScoreCalculateRequest,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    # 1. Start with defaults
    cfg = dict(_DEFAULTS)

    # 2. Overlay tariff DB values if tariff_id provided
    if body.tariff_id:
        rows = db.table("tariffs").select("*").eq("id", body.tariff_id).execute().data
        if not rows:
            raise HTTPException(status_code=404, detail="Tariff not found")
        t = rows[0]
        cfg.update({
            "w_affordability": t["w_affordability"],
            "w_credit": t["w_credit_history"],
            "w_behavioral": t["w_behavioral"],
            "w_demographic": t["w_demographic"],
            "min_score": t["min_score"],
            "partial_threshold": t["partial_threshold"],
            "partial_ratio": t["partial_ratio"],
            "hard_dti_min": t["hard_dti_min"],
            "max_open_loans": t["max_open_loans"],
            "max_overdue_days": t["max_overdue_days"],
            "bankruptcy_reject": t["bankruptcy_reject"],
        })

    # 3. Inline overrides win over both defaults and DB values
    overrides = {
        "w_affordability": body.w_affordability,
        "w_credit": body.w_credit,
        "w_behavioral": body.w_behavioral,
        "w_demographic": body.w_demographic,
        "min_score": body.min_score,
        "partial_threshold": body.partial_threshold,
        "partial_ratio": body.partial_ratio,
        "hard_dti_min": body.hard_dti_min,
        "max_open_loans": body.max_open_loans,
        "max_overdue_days": body.max_overdue_days,
        "bankruptcy_reject": body.bankruptcy_reject,
    }
    cfg.update({k: v for k, v in overrides.items() if v is not None})

    result = calculate_score_full(
        monthly_income=body.monthly_income,
        monthly_payment=body.monthly_payment,
        age=body.age,
        credit_history=body.credit_history,
        open_loans=body.open_loans,
        overdue_days=body.overdue_days,
        has_bankruptcy=body.has_bankruptcy,
        **cfg,
    )
    return ScoreCalculateResponse(**result)


@router.get("/{client_id}/history")
def score_history(
    client_id: str,
    current_user: dict = Depends(require_role("MFO_ADMIN")),
    db: Client = Depends(get_supabase),
):
    logs = (
        db.table("scoring_logs").select("*")
        .eq("client_id", client_id)
        .order("created_at", desc=True)
        .execute().data
    )
    return [
        {
            "id": log["id"],
            "applicationId": log["application_id"],
            "clientId": log["client_id"],
            "f1Affordability": log["income_score"],
            "f2Credit": log["credit_score"],
            "f4Demographic": log["age_score"],
            "f3Behavioral": log["tariff_score"],
            "totalScore": log["total_score"],
            "outcome": log["outcome"],
            "weightsSnapshot": log.get("weights_snapshot"),
            "hardReject": log.get("hard_reject"),
            "hardRejectReason": log.get("hard_reject_reason"),
            "reasonCodes": log.get("reason_codes"),
            "createdAt": log["created_at"],
        }
        for log in logs
    ]
