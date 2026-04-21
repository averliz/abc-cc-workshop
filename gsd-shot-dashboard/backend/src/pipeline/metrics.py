from __future__ import annotations

import time

import redis.asyncio as aioredis


def _throughput_key(source_id: str) -> str:
    return f"tput:{source_id}"


def _error_key(source_id: str) -> str:
    return f"errs:{source_id}"


async def record_fetch(
    redis: aioredis.Redis,
    source_id: str,
    ok: bool,
    items_emitted: int,
) -> None:
    """Record a fetch outcome. Each emitted item is a ZSET entry scored by ms epoch.

    The throughput ZSET is pruned lazily inside `get_throughput`. We keep a short
    TTL (120s) on the key so stale sources don't leak Redis memory.
    """
    now = int(time.time() * 1000)
    key = _throughput_key(source_id)

    if items_emitted > 0:
        pipe = redis.pipeline()
        for i in range(items_emitted):
            pipe.zadd(key, {f"{now}-{i}": now})
        pipe.expire(key, 120)
        await pipe.execute()

    if not ok:
        errk = _error_key(source_id)
        await redis.incr(errk)
        await redis.expire(errk, 3600)


async def get_throughput(
    redis: aioredis.Redis,
    source_id: str,
    window_s: int = 60,
) -> float:
    """Return items-per-minute observed in the last `window_s` seconds."""
    now = int(time.time() * 1000)
    cutoff = now - window_s * 1000
    key = _throughput_key(source_id)
    await redis.zremrangebyscore(key, 0, cutoff)
    n = await redis.zcard(key)
    if window_s <= 0:
        return 0.0
    return float(n) / (window_s / 60.0)


async def get_error_count_1h(redis: aioredis.Redis, source_id: str) -> int:
    v = await redis.get(_error_key(source_id))
    return int(v or 0)
