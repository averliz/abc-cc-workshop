from __future__ import annotations

import hashlib  # noqa: F401  (reserved for future hashing; keeps parity with RESEARCH)
import logging
from datetime import datetime, timezone
from typing import AsyncIterator

import feedparser
import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from src.connectors.base import SourceConnector, SourceHealth  # noqa: F401  (SourceConnector imported for runtime_checkable isinstance on callers)
from src.db import async_session
from src.models.feed_state import FeedState
from src.schemas.signal import Provenance, SignalEvent

log = logging.getLogger(__name__)


def _parse_struct_time(st) -> datetime | None:
    if not st:
        return None
    try:
        return datetime(*st[:6], tzinfo=timezone.utc)
    except Exception:
        return None


class RSSConnector:
    """Implements SourceConnector for RSS/Atom feeds. One instance per source_id."""

    def __init__(self, source_id: str, feed_url: str, poll_interval_s: int = 60) -> None:
        self.source_id = source_id
        self.feed_url = feed_url
        self.poll_interval_s = poll_interval_s

    async def _load_state(self) -> tuple[str | None, str | None]:
        async with async_session()() as s:
            fs = await s.scalar(
                select(FeedState).where(FeedState.source_id == self.source_id)
            )
            if fs is None:
                return None, None
            return fs.etag, fs.last_modified

    async def _save_state(
        self,
        etag: str | None,
        last_modified: str | None,
        success: bool,
        error: str | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        async with async_session()() as s, s.begin():
            set_values: dict = {
                "etag": etag,
                "last_modified": last_modified,
                "last_fetch_at": now,
            }
            if success:
                set_values["last_success_at"] = now
                set_values["last_error"] = None
            else:
                set_values["last_error"] = error

            stmt = pg_insert(FeedState).values(
                source_id=self.source_id,
                etag=etag,
                last_modified=last_modified,
                last_fetch_at=now,
                last_success_at=now if success else None,
                last_error=None if success else error,
            ).on_conflict_do_update(
                index_elements=[FeedState.source_id],
                set_=set_values,
            )
            await s.execute(stmt)

    async def fetch(self) -> AsyncIterator[SignalEvent]:
        etag, last_modified = await self._load_state()
        headers: dict[str, str] = {}
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified

        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                resp = await client.get(self.feed_url, headers=headers)
        except Exception as e:
            await self._save_state(etag, last_modified, success=False, error=str(e))
            raise

        if resp.status_code == 304:
            await self._save_state(etag, last_modified, success=True)
            return

        if resp.status_code >= 400:
            await self._save_state(
                etag, last_modified, success=False, error=f"HTTP {resp.status_code}"
            )
            resp.raise_for_status()

        new_etag = resp.headers.get("etag") or etag
        new_mod = resp.headers.get("last-modified") or last_modified

        parsed = feedparser.parse(resp.content)
        if getattr(parsed, "bozo", 0):
            # Pitfall 4: log but keep going — partial feeds are common.
            log.warning(
                "feedparser bozo for %s: %s",
                self.source_id,
                getattr(parsed, "bozo_exception", ""),
            )

        now = datetime.now(timezone.utc)
        for entry in parsed.entries:
            source_item_id = (
                entry.get("id") or entry.get("link") or entry.get("title")
            )
            if not source_item_id:
                continue

            det_id = SignalEvent.make_id(self.source_id, str(source_item_id))
            ts = (
                _parse_struct_time(entry.get("published_parsed"))
                or _parse_struct_time(entry.get("updated_parsed"))
                or now
            )
            # feedparser may synthesize `link` from guid for malformed items;
            # fall back to feed_url if it's not an absolute URL.
            raw_link = entry.get("link") or ""
            if raw_link.startswith(("http://", "https://")):
                link = raw_link
            else:
                link = self.feed_url

            # Filter raw to JSON-safe primitives only so downstream JSON serialization
            # (Pub/Sub, Streams payload) never blows up on FeedParserDict objects.
            raw_safe = {
                k: v
                for k, v in entry.items()
                if isinstance(v, (str, int, float, bool, list, dict, type(None)))
            }

            yield SignalEvent(
                id=det_id,
                source_item_id=str(source_item_id),
                timestamp=ts,
                author=entry.get("author"),
                title=entry.get("title"),
                content=entry.get("summary") or entry.get("description") or "",
                tags=[
                    t.get("term", "")
                    for t in entry.get("tags", [])
                    if isinstance(t, dict) and t.get("term")
                ],
                provenance=Provenance(
                    source_id=self.source_id,
                    source_type="rss",
                    source_url=link,
                    fetched_at=now,
                    ingested_at=now,
                    confidence=1.0,
                ),
                raw=raw_safe,
            )

        await self._save_state(new_etag, new_mod, success=True)

    async def health(self) -> SourceHealth:
        async with async_session()() as s:
            fs = await s.scalar(
                select(FeedState).where(FeedState.source_id == self.source_id)
            )
        if fs is None:
            return SourceHealth(self.source_id, None, None, 0, 0.0, "degraded")
        if fs.last_error is None and fs.error_count_1h == 0:
            status = "healthy"
        elif fs.error_count_1h < 5:
            status = "degraded"
        else:
            status = "failed"
        return SourceHealth(
            self.source_id,
            fs.last_success_at,
            fs.last_error,
            fs.error_count_1h,
            fs.throughput_per_min,
            status,
        )
