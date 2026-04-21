"""Synthetic load generator — Pitfall 10 guard.

Publishes SignalEvents through the real pipeline (dedupe + XADD + PUBLISH) at
the target rate for the given duration. Use this to prove the 1000+ items/min
success criterion is actually achievable, not just aspirational.

Usage:
    cd backend
    uv run python ../scripts/load_generator.py --rate 1000 --duration 60
    # then check signals row count:
    docker compose exec db psql -U osint -d osint \\
        -c "SELECT count(*) FROM signals WHERE source_id='loadgen:synth';"

The deterministic id uses `SignalEvent.make_id(source_id, source_item_id)`
with a timestamp-embedded `source_item_id`, so reruns within the same second
dedupe cleanly (Pitfall 2) and reruns more than 24h apart re-publish.
"""
from __future__ import annotations

import argparse
import asyncio
import time
from datetime import datetime, timezone

from src.pipeline.publisher import publish
from src.redis_client import get_redis
from src.schemas.signal import Provenance, SignalEvent


async def _run(rate_per_min: int, duration_s: int, source_id: str) -> None:
    interval = 60.0 / rate_per_min
    deadline = time.monotonic() + duration_s
    redis = get_redis()
    count = 0
    while time.monotonic() < deadline:
        now = datetime.now(timezone.utc)
        # Embed ms-precision timestamp so repeat runs inside the 24h dedupe
        # window produce unique item ids (but within the same run, the id is
        # deterministic from source_id+item_id via SignalEvent.make_id).
        item_id = f"loadgen-{count}-{int(now.timestamp() * 1000)}"
        det_id = SignalEvent.make_id(source_id, item_id)
        ev = SignalEvent(
            id=det_id,
            source_item_id=item_id,
            timestamp=now,
            title=f"Synthetic item {count}",
            content=f"Load generator payload {count}",
            tags=["loadgen"],
            provenance=Provenance(
                source_id=source_id,
                source_type="rss",
                source_url="https://loadgen.example.com/",
                fetched_at=now,
                ingested_at=now,
            ),
        )
        await publish(redis, ev)
        count += 1
        await asyncio.sleep(interval)
    print(f"generated {count} events in {duration_s}s (target {rate_per_min}/min)")


def main() -> int:
    p = argparse.ArgumentParser(description="OSINT pipeline load generator")
    p.add_argument("--rate", type=int, default=1000, help="items per minute")
    p.add_argument("--duration", type=int, default=60, help="seconds to run")
    p.add_argument("--source-id", type=str, default="loadgen:synth")
    args = p.parse_args()
    asyncio.run(_run(args.rate, args.duration, args.source_id))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
