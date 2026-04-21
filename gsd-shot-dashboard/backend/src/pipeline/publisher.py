from __future__ import annotations

import redis.asyncio as aioredis

from src.schemas.signal import SignalEvent

STREAM = "signals"
BROADCAST_CHANNEL = "signals:new"
DEDUPE_TTL_S = 86400
STREAM_MAXLEN = 100_000


async def publish(redis: aioredis.Redis, ev: SignalEvent) -> bool:
    """Publish a SignalEvent through the pipeline.

    Returns:
        True if the event was newly published.
        False if it was deduped (already seen inside DEDUPE_TTL_S window).

    Side-effects on success:
      1. Sets `dedupe:{ev.id}` = "1" with TTL 86400s and NX semantics (Pitfall 2:
         dedupe cache survives process restart because it lives in Redis).
      2. XADDs `{"payload": ev.model_dump_json()}` to the `signals` stream with
         approximate MAXLEN ~100000 for bounded growth (Pitfall 10).
      3. PUBLISHes the same JSON payload on the `signals:new` Pub/Sub channel so
         SSE subscribers can fan out without waiting for the persister.
    """
    added = await redis.set(f"dedupe:{ev.id}", "1", nx=True, ex=DEDUPE_TTL_S)
    if not added:
        return False
    payload = ev.model_dump_json()
    await redis.xadd(
        STREAM,
        {"payload": payload},
        maxlen=STREAM_MAXLEN,
        approximate=True,
    )
    await redis.publish(BROADCAST_CHANNEL, payload)
    return True
