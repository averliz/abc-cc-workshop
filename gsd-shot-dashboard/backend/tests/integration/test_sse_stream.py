"""SSE end-to-end integration test.

Logs in via POST /api/auth/login, opens a streaming GET to /api/stream via the
same httpx cookie jar, publishes a signal through the real pipeline, and
asserts the SSE stream delivers a frame carrying that signal's payload within
3 seconds.

Run:
    docker compose up -d db redis
    cd backend && uv run alembic upgrade head
    cd backend && uv run pytest -m integration tests/integration/test_sse_stream.py -x -q
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from src.auth.passwords import hash_password
from src.db import async_session
from src.main import app
from src.models.user import User
from src.pipeline.publisher import publish
from src.redis_client import get_redis
from src.schemas.signal import Provenance, SignalEvent

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module", autouse=True)
async def seed_user():
    async with async_session()() as s, s.begin():
        await s.execute(delete(User).where(User.email == "sse-it@test"))
        s.add(User(email="sse-it@test", password_hash=hash_password("ssepass123")))
    yield
    async with async_session()() as s, s.begin():
        await s.execute(delete(User).where(User.email == "sse-it@test"))


def _ev(n: int) -> SignalEvent:
    now = datetime.now(timezone.utc)
    sid = SignalEvent.make_id("rss:sse-it", f"sse-{n}-{int(now.timestamp() * 1e6)}")
    return SignalEvent(
        id=sid,
        source_item_id=f"sse-{n}",
        timestamp=now,
        content=f"sse test {n}",
        title=f"SSE {n}",
        provenance=Provenance(
            source_id="rss:sse-it",
            source_type="rss",
            source_url="https://sse.example.com/",
            fetched_at=now,
            ingested_at=now,
        ),
    )


@pytest.mark.asyncio
async def test_stream_receives_published_signal():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=30.0) as c:
        r = await c.post(
            "/api/auth/login",
            json={"email": "sse-it@test", "password": "ssepass123"},
        )
        assert r.status_code == 200

        received: list[str] = []
        stop = asyncio.Event()

        async def _consume() -> None:
            async with c.stream("GET", "/api/stream") as s_resp:
                assert s_resp.status_code == 200
                buf = ""
                async for chunk in s_resp.aiter_text():
                    buf += chunk
                    # SSE frames are separated by a blank line.
                    while "\n\n" in buf:
                        frame, buf = buf.split("\n\n", 1)
                        for line in frame.splitlines():
                            if line.startswith("data:"):
                                received.append(line[len("data:") :].strip())
                    if stop.is_set():
                        break

        consumer = asyncio.create_task(_consume())

        # Give the SSE handler a moment to subscribe to Pub/Sub.
        await asyncio.sleep(1.0)

        ev = _ev(1)
        r_client = get_redis()
        assert await publish(r_client, ev) is True

        # Poll up to 3s for the frame to land.
        for _ in range(30):
            if any(ev.id in payload for payload in received):
                break
            await asyncio.sleep(0.1)

        stop.set()
        consumer.cancel()
        try:
            await consumer
        except Exception:  # noqa: BLE001
            pass

        matching = [p for p in received if ev.id in p]
        assert matching, f"SSE did not deliver signal {ev.id}; received={received[:5]}"
        payload = json.loads(matching[0])
        assert payload["title"] == "SSE 1"
        # DTO shape excludes raw (RESEARCH Pattern 2).
        assert "raw" not in payload
