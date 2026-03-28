from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional


class ProductCreate(BaseModel):
    merchant_id: str
    name: str
    category: str
    price: int
    description: Optional[str] = ""
    available: bool = True
    down_payment_percent: int = 0

    @field_validator("down_payment_percent")
    @classmethod
    def validate_down_payment(cls, v):
        if not (0 <= v <= 50):
            raise ValueError("down_payment_percent must be between 0 and 50")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[int] = None
    description: Optional[str] = None
    available: Optional[bool] = None
    down_payment_percent: Optional[int] = None

    @field_validator("down_payment_percent")
    @classmethod
    def validate_down_payment(cls, v):
        if v is not None and not (0 <= v <= 50):
            raise ValueError("down_payment_percent must be between 0 and 50")
        return v


class ProductOut(BaseModel):
    id: str
    merchantId: str
    name: str
    category: str
    price: int
    description: Optional[str] = ""
    available: bool
    downPaymentPercent: int
    imageUrl: Optional[str] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
