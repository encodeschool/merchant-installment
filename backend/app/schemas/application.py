from pydantic import BaseModel, ConfigDict
from typing import Optional, Literal
from ..schemas.client import ClientCreate


class ApplicationCreate(BaseModel):
    merchant_id: str
    product_id: str
    tariff_id: str
    months: int
    client: ClientCreate


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
    min_monthly_payment: float   # at max months
    max_monthly_payment: float   # at min months
    min_down_payment_pct: float
    approved_amount: int
    approved_ratio: float


class ScoreResultOut(BaseModel):
    f1: float
    f2: float
    f3: float
    f4: float
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
    fraud_gate: str   # PASS | FLAG | BLOCK
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


# ── MFO decision ───────────────────────────────────────────────────────────────

class DecisionRequest(BaseModel):
    action: Literal["APPROVED", "PARTIAL", "REJECTED"]
    approved_amount: Optional[int] = None
    note: Optional[str] = None


class ApplicationOut(BaseModel):
    id: str
    merchantId: str
    merchantName: str
    clientName: str
    clientPhone: str
    productName: str
    productPrice: int
    tariffId: str
    tariffName: str
    months: int
    monthlyPayment: int
    totalAmount: int
    score: int
    status: str
    approvedAmount: Optional[int] = None
    createdAt: str
    decidedAt: Optional[str] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
