"""End-to-end pipeline smoke against live compose-backed Redis + Postgres.

Requires:
  docker compose up -d db redis
  uv run alembic upgrade head

Run:
  uv run pytest -m integration tests/integration/test_pipeline_end_to_end.py -x -q
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest
from sqlalchemy import delete, select

from src.db import async_session
from src.models.signal import Signal
from src.pipeline.broadcaster import BROADCAST_CHANNEL, run_broadcaster
from src.pipeline.persister import run_persister
from src.pipeline.publisher import STREAM, publish
from src.redis_client import get_redis
from src.schemas.signal import Provenance, SignalEvent

pytestmark = pytest.mark.integration


def _ev(suffix: str) -> SignalEvent:
    now = datetime.now(timezone.utc)
    sid = SignalEvent.make_id("rss:it-test", f"it-{suffix}")
    return SignalEvent(
        id=sid,
        source_item_id=f"it-{suffix}",
        timestamp=now,
        content=f"pipeline test {suffix}",
        title=f"IT {suffix}",
        provenance=Provenance(
            source_id="rss:it-test",
            source_type="rss",
            source_url="https://example.com/it",
            fetched_at=now,
            ingested_at=now,
        ),
    )


@pytest.mark.asyncio
async def test_publish_then_persist_and_broadcast():
    r = get_redis()
    # Clean slate for the test stream and any stale IT rows.
    try:
        await r.xtrim(STREAM, maxlen=0, approximate=False)
    except Exception:
        pass
    async with async_session()() as s, s.begin():
        await s.execute(delete(Signal).where(Signal.source_id == "rss:it-test"))

    stop = asyncio.Event()
    persister_task = asyncio.create_task(run_persister(r, stop))
    broadcaster_task = asyncio.create_task(run_broadcaster(r, stop))

    pubsub = r.pubsub()
    await pubsub.subscribe(BROADCAST_CHANNEL)
    await pubsub.get_message(timeout=0.5)  # drain subscribe ack

    ev = _ev("1")
    assert await publish(r, ev) is True

    # Wait up to 10s for persistence.
    row = None
    async with async_session()() as s:
        for _ in range(20):
            row = await s.scalar(select(Signal).where(Signal.id == ev.id))
            if row is not None:
                break
            await asyncio.sleep(0.5)
    assert row is not None and row.title == "IT 1"

    # Wait up to 10s for broadcast.
    got_broadcast = False
    for _ in range(20):
        msg = await pubsub.get_message(
            timeout=0.5, ignore_subscribe_messages=True
        )
        if msg and msg["type"] == "message":
            got_broadcast = True
            break
    assert got_broadcast, "broadcaster did not re-publish to signals:new"

    stop.set()
    for t in (persister_task, broadcaster_task):
        t.cancel()
        try:
            await t
        except Exception:
            pass
    await pubsub.aclose()
