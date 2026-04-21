"""End-to-end auth flow against the running backend (docker compose up db redis + uvicorn).

Marked @pytest.mark.integration — does NOT run by default. Run via:
    uv run pytest -m integration tests/integration/
Requires:
    1. docker compose up -d db redis
    2. alembic upgrade head
    3. The create_user CLI has seeded analyst@test / testpass123
"""
from __future__ import annotations
import asyncio
import os
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from src.main import app
from src.db import async_session
from src.models.user import User
from src.auth.passwords import hash_password


pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module", autouse=True)
async def seed_user():
    async with async_session()() as s, s.begin():
        await s.execute(delete(User).where(User.email == "it-auth@test"))
        s.add(User(email="it-auth@test", password_hash=hash_password("testpass123")))
    yield
    async with async_session()() as s, s.begin():
        await s.execute(delete(User).where(User.email == "it-auth@test"))


@pytest.mark.asyncio
async def test_full_auth_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        # /me without cookie → 401
        r = await c.get("/api/auth/me")
        assert r.status_code == 401

        # Bad credentials → 401
        r = await c.post("/api/auth/login", json={"email": "it-auth@test", "password": "wrong"})
        assert r.status_code == 401

        # Good credentials → 200 + cookie
        r = await c.post("/api/auth/login", json={"email": "it-auth@test", "password": "testpass123"})
        assert r.status_code == 200
        assert r.json()["email"] == "it-auth@test"
        cookie_name = os.environ.get("COOKIE_NAME", "osint_session")
        assert cookie_name in c.cookies

        # /me with cookie → 200 (session survives "refresh": httpx client re-uses cookie jar)
        r = await c.get("/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == "it-auth@test"

        # Logout → cookie cleared
        r = await c.post("/api/auth/logout")
        assert r.status_code == 204

        # /me again → 401
        r = await c.get("/api/auth/me")
        assert r.status_code == 401
