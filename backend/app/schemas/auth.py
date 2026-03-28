from pydantic import BaseModel, ConfigDict
from typing import Optional


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    organization: str
    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    organization: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None
