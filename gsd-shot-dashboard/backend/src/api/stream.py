"""SSE endpoint — live + replay.

Uses `sse-starlette`'s `EventSourceResponse` + `ServerSentEvent` (the upstream
library that ships `fastapi.sse` once FastAPI vendors it). API is identical to
the `fastapi.sse` shape targeted by the plan; pinned in pyproject.toml.

Pitfall 3 (disconnect): checks `request.is_disconnected()` each iteration;
`pubsub.get_message(timeout=1.0)` is bounded so the loop never blocks past
the disconnect check. Pub/Sub is unsubscribed + closed in a `finally` block
so zombie subscribers cannot accumulate.

Pitfall 6 / 12 (proxy buffering): `EventSourceResponse` sets `Cache-Control: no-cache`
and `X-Accel-Buffering: no`. Caddy side is tuned in Plan 01-01 (`flush_interval -1`).
"""
from __future__ import annotations

import json
import logging
from typing import AsyncIterable

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import select
from sse_starlette import EventSourceResponse, ServerSentEvent

from src.api.signals import SignalEventDTO
from src.auth.dependencies import require_user
from src.db import async_session
from src.models.signal import Signal
from src.models.user import User
from src.pipeline.publisher import BROADCAST_CHANNEL
from src.redis_client import get_redis
from src.schemas.signal import SignalEvent

log = logging.getLogger(__name__)

router = APIRouter(tags=["stream"])

# Cap backfill replay to protect the endpoint under aggressive reconnect loops.
_BACKFILL_CAP = 500


async def _backfill_since(last_event_id: str) -> AsyncIterable[Signal]:
    """Replay signals with ingested_at strictly greater than the given id's anchor.

    `last_event_id` format: signal.id (sha256 hex). We look up its ingested_at
    then replay everything newer, capped at `_BACKFILL_CAP`.
    """
    async with async_session()() as s:
        anchor = await s.scalar(select(Signal).where(Signal.id == last_event_id))
        if anchor is None:
            return
        stmt = (
            select(Signal)
            .where(Signal.ingested_at > anchor.ingested_at)
            .order_by(Signal.ingested_at.asc(), Signal.id.asc())
            .limit(_BACKFILL_CAP)
        )
        rows = (await s.scalars(stmt)).all()

    for row in rows:
        yield row


def _dto_from_event(ev: SignalEvent) -> dict:
    """SignalEvent (pipeline shape) -> SignalEventDTO dict (wire shape, no `raw`)."""
    return {
        "id": ev.id,
        "source_item_id": ev.source_item_id,
        "source_id": ev.provenance.source_id,
        "source_type": ev.provenance.source_type,
        "source_url": str(ev.provenance.source_url),
        "timestamp": ev.timestamp.isoformat(),
        "ingested_at": ev.provenance.ingested_at.isoformat(),
        "author": ev.author,
        "title": ev.title,
        "content": ev.content,
        "tags": list(ev.tags),
        "confidence": ev.provenance.confidence,
    }


async def _signal_stream(
    request: Request, last_event_id: str | None
) -> AsyncIterable[ServerSentEvent]:
    # Establish the stream — helps some proxies flush initial bytes immediately.
    yield ServerSentEvent(comment="stream-ready")

    # 1. Replay any rows newer than Last-Event-ID (if client is reconnecting).
    if last_event_id:
        async for row in _backfill_since(last_event_id):
            dto = SignalEventDTO.from_row(row)
            yield ServerSentEvent(
                id=dto.id,
                event="signal",
                data=dto.model_dump_json(),
            )

    # 2. Live fanout from Pub/Sub.
    redis = get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(BROADCAST_CHANNEL)
    try:
        while True:
            # Pitfall 3: check disconnect every iteration.
            if await request.is_disconnected():
                break
            # Bounded read — get_message returns None after `timeout` seconds,
            # which gives the disconnect check a chance to fire.
            # Do NOT use pubsub.listen(): it blocks forever.
            msg = await pubsub.get_message(timeout=1.0, ignore_subscribe_messages=True)
            if msg is None or msg.get("type") != "message":
                continue
            try:
                ev = SignalEvent.model_validate_json(msg["data"])
            except Exception as e:  # noqa: BLE001
                log.warning("stream: bad payload dropped: %s", e)
                continue
            yield ServerSentEvent(
                id=ev.id,
                event="signal",
                data=json.dumps(_dto_from_event(ev)),
            )
    finally:
        try:
            await pubsub.unsubscribe(BROADCAST_CHANNEL)
            await pubsub.aclose()
        except Exception:  # noqa: BLE001
            # Best-effort cleanup; already-closed redis should not mask a real error.
            pass


@router.get("/api/stream")
async def stream(
    request: Request,
    _user: User = Depends(require_user),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
) -> EventSourceResponse:
    return EventSourceResponse(_signal_stream(request, last_event_id))
