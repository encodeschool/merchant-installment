from fastapi import APIRouter, Depends
from supabase import Client
from pydantic import BaseModel

from ..core.database import get_supabase
from ..core.deps import get_current_user, require_role
from ..services.scoring import calculate_score, get_outcome, monthly_payment as calc_monthly_payment

router = APIRouter()


class ScoreCalculateRequest(BaseModel):
    monthly_income: int
    age: int
    credit_history: str
    principal: int
    months: int
    annual_rate: float
    tariff_min_score: int


class ScoreCalculateResponse(BaseModel):
    income_score: int
    credit_score: int
    age_score: int
    tariff_score: int
    total: int
    outcome: str
    monthly_payment: float


@router.post("/calculate", response_model=ScoreCalculateResponse)
def score_calculate(
    body: ScoreCalculateRequest,
    current_user: dict = Depends(get_current_user),
):
    mp = calc_monthly_payment(body.principal, body.months, body.annual_rate)
    breakdown = calculate_score(body.monthly_income, mp, body.age, body.credit_history)
    outcome = get_outcome(breakdown["total"], body.tariff_min_score)
    return ScoreCalculateResponse(
        income_score=breakdown["income_score"],
        credit_score=breakdown["credit_score"],
        age_score=breakdown["age_score"],
        tariff_score=breakdown["tariff_score"],
        total=breakdown["total"],
        outcome=outcome,
        monthly_payment=mp,
    )


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
            "incomeScore": log["income_score"],
            "creditScore": log["credit_score"],
            "ageScore": log["age_score"],
            "tariffScore": log["tariff_score"],
            "totalScore": log["total_score"],
            "outcome": log["outcome"],
            "createdAt": log["created_at"],
        }
        for log in logs
    ]
