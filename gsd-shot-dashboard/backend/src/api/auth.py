from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from src.config import get_settings
from src.db import async_session
from src.models.user import User
from src.auth.passwords import verify_password
from src.auth.sessions import issue_session_cookie
from src.auth.dependencies import require_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str


@router.post("/login", response_model=UserOut)
async def login(body: LoginRequest, response: Response) -> UserOut:
    settings = get_settings()
    async with async_session()() as s:
        u = await s.scalar(select(User).where(User.email == body.email))
    # Timing-ish: always verify against SOMETHING to reduce timing leak.
    valid = u is not None and verify_password(body.password, u.password_hash)
    if not valid or u is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")
    token = issue_session_cookie(u.id)
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.session_max_age_s,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )
    return UserOut(id=u.id, email=u.email)


@router.post("/logout", status_code=204)
async def logout(response: Response) -> Response:
    response.delete_cookie(get_settings().cookie_name, path="/")
    return Response(status_code=204)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(require_user)) -> UserOut:
    return UserOut(id=user.id, email=user.email)
