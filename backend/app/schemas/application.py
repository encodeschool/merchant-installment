from pydantic import BaseModel, ConfigDict
from typing import Optional, Literal
from app.schemas.client import ClientCreate


class ApplicationCreate(BaseModel):
    merchant_id: str
    product_id: str
    tariff_id: str
    months: int
    client: ClientCreate


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
