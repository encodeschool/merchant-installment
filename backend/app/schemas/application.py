from pydantic import BaseModel, ConfigDict
from typing import Optional
from ..schemas.client import ClientCreate


# ── Multi-product flow ─────────────────────────────────────────────────────────


class MultiProductItem(BaseModel):
    product_id: str
    quantity: int = 1


class MultiProductCreate(BaseModel):
    merchant_id: str
    items: list[MultiProductItem]
    months: int = 12
    client: ClientCreate
    face_image_b64: str = ""
    signature_b64: str = ""


class EligibleOffer(BaseModel):
    tariff_id: str
    mfo_name: str
    tariff_name: str
    interest_rate: float
    available_months: list[int]
    min_monthly_payment: float
    max_monthly_payment: float
    min_down_payment_pct: float
    approved_amount: int
    approved_ratio: float


class ScoreResultOut(BaseModel):
    f1_affordability: float
    f2_credit: float
    f3_behavioral: float
    f4_demographic: float
    total_score: int
    decision: str
    weights: dict
    hard_reject: bool
    hard_reject_reason: Optional[str] = None
    reason_codes: list[str]
    approved_ratio: float


class MultiProductResponse(BaseModel):
    id: str
    score_result: ScoreResultOut
    eligible_offers: list[EligibleOffer]
    fraud_gate: str
    fraud_signals: list[str]


class ConfirmRequest(BaseModel):
    tariff_id: str
    months: int
    signature_b64: str = ""


class ConfirmResponse(BaseModel):
    id: str
    status: str
    monthly_payment: int
    total_amount: int
    months: int


# ── New detailed output schemas ────────────────────────────────────────────────


class ApplicationItemOut(BaseModel):
    product_id: str
    product_name: str
    category: str
    price: int
    quantity: int
    subtotal: int
    image_url: Optional[str] = None


class ClientDetailOut(BaseModel):
    full_name: str
    passport_number: str
    phone: str
    age: int
    monthly_income: int
    employment_type: str
    open_loans: int
    overdue_days: int
    has_bankruptcy: bool
    credit_history: str
    pinfl: Optional[str] = None


class ScoreBreakdownOut(BaseModel):
    f1_affordability: float
    f2_credit: float
    f3_behavioral: float
    f4_demographic: float
    weights: dict
    total_score: int
    decision: str
    approved_ratio: float
    hard_reject: bool
    hard_reject_reason: Optional[str]
    reason_codes: list[str]


class FraudSignalOut(BaseModel):
    code: str
    severity: str  # 'block' | 'warning' | 'info'
    score_impact: int
    description: str


class ApplicationOut(BaseModel):
    id: str
    merchant_id: str
    merchant_name: str

    client: ClientDetailOut

    items: list[ApplicationItemOut]
    total_amount: int
    down_payment_amount: int
    financed_amount: int

    tariff_id: Optional[str]
    tariff_name: Optional[str]
    mfo_name: Optional[str]
    months: Optional[int]
    monthly_payment: Optional[int]
    approved_amount: Optional[int]

    score: int
    score_breakdown: Optional[ScoreBreakdownOut]

    fraud_gate: str
    fraud_signals: list[FraudSignalOut]

    face_image_url: Optional[str]
    signature_url: Optional[str]

    status: str
    decision_source: str  # always "AUTOMATED"
    created_at: str

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
