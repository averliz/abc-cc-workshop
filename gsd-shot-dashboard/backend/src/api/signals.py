from __future__ import annotations
from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, HttpUrl
from sqlalchemy import select, tuple_
from src.auth.dependencies import require_user
from src.db import async_session
from src.models.signal import Signal
from src.models.user import User

router = APIRouter(prefix="/api/signals", tags=["signals"])


class SignalEventDTO(BaseModel):
    """On-wire shape for a signal. NOTE: excludes `raw` field (RESEARCH §Pattern 2).

    Shape is stable — Plan 05 (frontend) + all downstream phases consume this.
    """

    id: str
    source_item_id: str
    source_id: str
    source_type: str
    source_url: HttpUrl
    timestamp: datetime
    ingested_at: datetime
    author: str | None = None
    title: str | None = None
    content: str
    tags: list[str]
    confidence: float

    @classmethod
    def from_row(cls, row: Signal) -> "SignalEventDTO":
        return cls(
            id=row.id,
            source_item_id=row.source_item_id,
            source_id=row.source_id,
            source_type=row.source_type,
            source_url=row.source_url,
            timestamp=row.ts,
            ingested_at=row.ingested_at,
            author=row.author,
            title=row.title,
            content=row.content,
            tags=list(row.tags or []),
            confidence=row.confidence,
        )


class SignalsPage(BaseModel):
    items: list[SignalEventDTO]
    next_cursor: str | None = None  # "<ingested_at_iso>|<id>"


@router.get("", response_model=SignalsPage)
async def list_signals(
    _user: Annotated[User, Depends(require_user)],
    limit: int = Query(100, ge=1, le=500),
    cursor: str | None = Query(None, description="opaque cursor from previous page"),
    source_id: str | None = Query(None, description="filter to a single source"),
) -> SignalsPage:
    """Backfill endpoint: returns most-recent signals ordered by ingested_at DESC.

    Pagination uses a composite cursor `(ingested_at, id)` keyset scan to avoid
    OFFSET drift on a hot write path.
    """
    stmt = (
        select(Signal)
        .order_by(Signal.ingested_at.desc(), Signal.id.desc())
        .limit(limit + 1)
    )
    if source_id:
        stmt = stmt.where(Signal.source_id == source_id)
    if cursor:
        try:
            iso, sid = cursor.split("|", 1)
            c_ts = datetime.fromisoformat(iso)
            stmt = stmt.where(
                tuple_(Signal.ingested_at, Signal.id) < tuple_(c_ts, sid)
            )
        except Exception:
            # Bad cursor → ignore, return first page.
            pass

    async with async_session()() as s:
        rows = (await s.scalars(stmt)).all()

    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor: str | None = None
    if has_more and rows:
        last = rows[-1]
        next_cursor = f"{last.ingested_at.isoformat()}|{last.id}"

    return SignalsPage(
        items=[SignalEventDTO.from_row(r) for r in rows],
        next_cursor=next_cursor,
    )
