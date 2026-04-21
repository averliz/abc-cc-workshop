from __future__ import annotations
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from src.config import get_settings
from src.db import async_session
from src.models.user import User
from src.auth.sessions import verify_session_cookie


async def require_user(request: Request) -> User:
    cookie = request.cookies.get(get_settings().cookie_name)
    if not cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    uid = verify_session_cookie(cookie)
    if uid is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid or expired session")
    async with async_session()() as s:
        u = await s.scalar(select(User).where(User.id == uid))
        if u is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
        return u
