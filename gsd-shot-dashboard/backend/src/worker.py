from __future__ import annotations

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from src.config import get_settings
from src.connectors.registry import all_connectors, clear, register
from src.connectors.rss import RSSConnector
from src.db import async_session
from src.models.source import Source
from src.pipeline.broadcaster import run_broadcaster
from src.pipeline.metrics import record_fetch
from src.pipeline.persister import run_persister
from src.pipeline.publisher import publish
from src.redis_client import get_redis

log = logging.getLogger(__name__)


async def load_sources() -> None:
    """Read enabled rows from `sources` and register one connector per row."""
    clear()
    async with async_session()() as s:
        rows = (
            await s.scalars(select(Source).where(Source.enabled.is_(True)))
        ).all()
    for row in rows:
        if row.source_type == "rss":
            feed_url = row.config.get("feed_url")
            if not feed_url:
                log.warning("source %s has no feed_url; skipping", row.source_id)
                continue
            register(
                RSSConnector(
                    row.source_id,
                    feed_url,
                    poll_interval_s=row.config.get("poll_interval_s", 60),
                )
            )
        else:
            log.warning(
                "unknown source_type %s for %s (Phase 2+)",
                row.source_type,
                row.source_id,
            )


async def poll_once(connector) -> None:
    """Single poll cycle for one connector: fetch -> publish -> metrics."""
    redis = get_redis()
    count = 0
    ok = True
    try:
        async for ev in connector.fetch():
            published = await publish(redis, ev)
            if published:
                count += 1
    except Exception as e:
        ok = False
        log.exception("fetch failed for %s: %s", connector.source_id, e)
    await record_fetch(redis, connector.source_id, ok=ok, items_emitted=count)


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    get_settings()  # validate env early; fail fast on missing config
    await load_sources()

    scheduler = AsyncIOScheduler(timezone="UTC")
    for c in all_connectors():
        scheduler.add_job(
            poll_once,
            "interval",
            seconds=c.poll_interval_s,
            args=[c],
            id=c.source_id,
            max_instances=1,
            coalesce=True,
        )
    scheduler.start()
    log.info("scheduler started with %d connectors", len(all_connectors()))

    redis = get_redis()
    stop = asyncio.Event()
    # Two-consumer-group architecture (RESEARCH §Pattern 3): persister and
    # broadcaster run concurrently so DB backpressure never starves the
    # broadcast path and vice versa.
    await asyncio.gather(
        run_persister(redis, stop),
        run_broadcaster(redis, stop),
    )


if __name__ == "__main__":
    asyncio.run(main())
