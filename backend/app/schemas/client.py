from pydantic import BaseModel, ConfigDict


class ClientCreate(BaseModel):
    full_name: str
    passport_number: str
    phone: str
    monthly_income: int
    age: int
    credit_history: str = "NONE"
    open_loans: int = 0
    overdue_days: int = 0
    has_bankruptcy: bool = False


class ClientOut(BaseModel):
    id: str
    fullName: str
    passportNumber: str
    phone: str
    monthlyIncome: int
    age: int
    creditHistory: str
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
