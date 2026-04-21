from __future__ import annotations

import asyncio
import logging

import redis.asyncio as aioredis
from redis.exceptions import ResponseError

from src.pipeline.publisher import BROADCAST_CHANNEL, STREAM

log = logging.getLogger(__name__)

BROADCAST_GROUP = "broadcast"
BROADCAST_CONSUMER = "broadcast-1"


async def _ensure_group(redis: aioredis.Redis, group: str) -> None:
    try:
        await redis.xgroup_create(STREAM, group, id="0", mkstream=True)
    except ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


async def run_broadcaster(
    redis: aioredis.Redis,
    stop: asyncio.Event | None = None,
) -> None:
    """Consume `signals` via the broadcast consumer group and re-publish each
    payload to the ephemeral Pub/Sub `signals:new` channel. If no SSE
    subscribers exist, ACK anyway — we MUST NOT let the stream lag just because
    no analysts are watching."""
    await _ensure_group(redis, BROADCAST_GROUP)
    while stop is None or not stop.is_set():
        resp = await redis.xreadgroup(
            BROADCAST_GROUP,
            BROADCAST_CONSUMER,
            {STREAM: ">"},
            count=100,
            block=5000,
        )
        if not resp:
            continue
        for _stream, entries in resp:
            ids_to_ack: list[str] = []
            for entry_id, fields in entries:
                payload = fields.get("payload")
                if payload:
                    await redis.publish(BROADCAST_CHANNEL, payload)
                ids_to_ack.append(entry_id)
            if ids_to_ack:
                await redis.xack(STREAM, BROADCAST_GROUP, *ids_to_ack)
