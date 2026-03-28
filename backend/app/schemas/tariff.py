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


class ScoringConfigUpdate(BaseModel):
    w_affordability: Optional[float] = None
    w_credit_history: Optional[float] = None
    w_behavioral: Optional[float] = None
    w_demographic: Optional[float] = None
    min_score: Optional[int] = None
    partial_threshold: Optional[int] = None
    partial_ratio: Optional[float] = None
    hard_dti_min: Optional[float] = None
    max_open_loans: Optional[int] = None
    max_overdue_days: Optional[int] = None
    bankruptcy_reject: Optional[bool] = None

    @model_validator(mode="after")
    def validate_weights_and_thresholds(self):
        weights = [self.w_affordability, self.w_credit_history, self.w_behavioral, self.w_demographic]
        provided = [w for w in weights if w is not None]
        if len(provided) > 0 and len(provided) < 4:
            raise ValueError("All four weights must be provided together")
        if len(provided) == 4:
            total = sum(provided)
            if abs(total - 1.0) > 0.001:
                raise ValueError(f"Weights must sum to 1.0 (got {total:.4f})")

        if self.partial_ratio is not None and not (0.5 <= self.partial_ratio <= 0.9):
            raise ValueError("partial_ratio must be between 0.5 and 0.9")

        return self


class ScoringConfigOut(BaseModel):
    w_affordability: float
    w_credit_history: float
    w_behavioral: float
    w_demographic: float
    min_score: int
    partial_threshold: int
    partial_ratio: float
    hard_dti_min: float
    max_open_loans: int
    max_overdue_days: int
    bankruptcy_reject: bool


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
