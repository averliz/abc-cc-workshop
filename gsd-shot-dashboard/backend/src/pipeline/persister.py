from __future__ import annotations

import asyncio
import logging

import redis.asyncio as aioredis
from redis.exceptions import ResponseError

from src.db import async_session
from src.models.signal import Signal
from src.pipeline.publisher import STREAM
from src.schemas.signal import SignalEvent

log = logging.getLogger(__name__)

PERSIST_GROUP = "persist"
PERSIST_CONSUMER = "persist-1"


async def _ensure_group(redis: aioredis.Redis, group: str) -> None:
    try:
        await redis.xgroup_create(STREAM, group, id="0", mkstream=True)
    except ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


async def run_persister(
    redis: aioredis.Redis,
    stop: asyncio.Event | None = None,
) -> None:
    """Consume `signals` via the persist consumer group, write to the hypertable,
    then XACK. Pattern 3 two-consumer-group split: persister latency is bounded
    by DB latency but NEVER blocks broadcaster."""
    await _ensure_group(redis, PERSIST_GROUP)
    while stop is None or not stop.is_set():
        resp = await redis.xreadgroup(
            PERSIST_GROUP,
            PERSIST_CONSUMER,
            {STREAM: ">"},
            count=100,
            block=5000,
        )
        if not resp:
            continue
        for _stream, entries in resp:
            ids_to_ack: list[str] = []
            async with async_session()() as s, s.begin():
                for entry_id, fields in entries:
                    try:
                        ev = SignalEvent.model_validate_json(fields["payload"])
                    except Exception as e:
                        log.error(
                            "persister: bad payload, dropping %s: %s", entry_id, e
                        )
                        ids_to_ack.append(entry_id)
                        continue
                    row = Signal.from_event(ev)
                    # s.merge is idempotent on composite PK (id, ingested_at),
                    # tolerating at-least-once redelivery.
                    await s.merge(row)
                    ids_to_ack.append(entry_id)
            # ACK only after commit — if DB fails, message stays pending and
            # retries on next loop iteration.
            if ids_to_ack:
                await redis.xack(STREAM, PERSIST_GROUP, *ids_to_ack)
