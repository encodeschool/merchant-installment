from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class InstallmentOut(BaseModel):
    id: str
    contractId: str
    installmentNumber: int
    dueDate: str
    amount: int
    paidAt: Optional[str] = None
    status: str
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ContractOut(BaseModel):
    id: str
    applicationId: str
    clientName: str
    merchantName: str
    productName: str
    totalAmount: int
    months: int
    monthlyPayment: int
    nextPaymentDate: Optional[str] = None
    paidInstallments: int
    status: str
    createdAt: str
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ContractPage(BaseModel):
    items: List[ContractOut]
    total: int
    page: int
    page_size: int
    total_pages: int
