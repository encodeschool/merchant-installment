from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from ..core.database import get_supabase
from ..core.security import verify_password, create_access_token, create_refresh_token, decode_token
from ..core.deps import get_current_user, oauth2_scheme
from ..schemas.auth import LoginRequest, TokenResponse, RefreshRequest, UserOut

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Client = Depends(get_supabase)):
    response = db.table("users").select("*").eq("email", body.email).execute()
    user = response.data[0] if response.data else None

    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.get("is_active"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is inactive")

    token_data = {"sub": user["id"], "role": user["role"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest):
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    token_data = {"sub": payload["sub"], "role": payload["role"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: str = Depends(oauth2_scheme)):
    pass


@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    return UserOut(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user["email"],
        role=current_user["role"],
        organization=current_user.get("organization"),
    )
