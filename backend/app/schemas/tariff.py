from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from typing import Optional

VALID_MONTHS = {3, 6, 9, 12}


class TariffCreate(BaseModel):
    name: str
    interest_rate: float
    min_amount: int
    max_amount: int
    min_months: int
    max_months: int
    min_score: int

    @field_validator("min_months", "max_months")
    @classmethod
    def validate_months(cls, v):
        if v not in VALID_MONTHS:
            raise ValueError("Months must be one of 3, 6, 9, 12")
        return v

    @model_validator(mode="after")
    def validate_ranges(self):
        if self.min_amount >= self.max_amount:
            raise ValueError("min_amount must be less than max_amount")
        if self.min_months > self.max_months:
            raise ValueError("min_months must be <= max_months")
        return self


class TariffUpdate(BaseModel):
    name: Optional[str] = None
    interest_rate: Optional[float] = None
    min_amount: Optional[int] = None
    max_amount: Optional[int] = None
    min_months: Optional[int] = None
    max_months: Optional[int] = None
    min_score: Optional[int] = None

    @field_validator("min_months", "max_months")
    @classmethod
    def validate_months(cls, v):
        if v is not None and v not in VALID_MONTHS:
            raise ValueError("Months must be one of 3, 6, 9, 12")
        return v


class TariffOut(BaseModel):
    id: str
    name: str
    mfoName: str
    interestRate: float
    minAmount: int
    maxAmount: int
    minMonths: int
    maxMonths: int
    minScore: int
    status: str
    createdAt: str
    approvedAt: Optional[str] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
