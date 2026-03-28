from pydantic import BaseModel, ConfigDict
from typing import Optional


class MerchantCreate(BaseModel):
    name: str
    legal_name: str
    category: str
    phone: str
    address: str


class MerchantUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    category: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class MerchantStatusUpdate(BaseModel):
    status: str


class MerchantOut(BaseModel):
    id: str
    name: str
    legalName: str
    category: str
    phone: str
    address: str
    status: str
    totalApplications: int = 0
    approvedApplications: int = 0
    joinedAt: str
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class MerchantStats(BaseModel):
    totalApplications: int
    approvedApplications: int
    totalDisbursed: int
