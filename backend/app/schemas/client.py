from pydantic import BaseModel, ConfigDict
from typing import Optional


class ClientCreate(BaseModel):
    full_name: str = ""
    passport_number: str
    phone: str = ""
    monthly_income: int = 0
    age: int = 30
    birth_date: Optional[str] = None  # ISO date string, used to compute age
    credit_history: str = "NONE"
    open_loans: int = 0
    overdue_days: int = 0
    has_bankruptcy: bool = False
    employment_type: str = (
        "EMPLOYED"  # EMPLOYED|SELF_EMPLOYED|BUSINESS_OWNER|PENSIONER|OTHER
    )


class ClientOut(BaseModel):
    id: str
    fullName: str
    passportNumber: str
    phone: str
    monthlyIncome: int
    age: int
    creditHistory: str
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
