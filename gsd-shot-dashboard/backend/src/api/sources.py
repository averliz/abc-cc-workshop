"""Source health endpoint — backend side of DASH-05 (sidebar health badges).

Composes Postgres (`sources`, `feed_state`) + Redis metrics (throughput, errs)
into a single list the dashboard can render. Status derivation lives here so
the frontend only ever renders the final healthy|degraded|failed badge.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from src.auth.dependencies import require_user
from src.db import async_session
from src.models.feed_state import FeedState
from src.models.source import Source
from src.models.user import User
from src.pipeline.metrics import get_error_count_1h, get_throughput
from src.redis_client import get_redis

router = APIRouter(prefix="/api/sources", tags=["sources"])

HealthStatus = Literal["healthy", "degraded", "failed"]


class SourceHealthDTO(BaseModel):
    source_id: str
    source_type: str
    enabled: bool
    last_fetch_at: datetime | None
    last_success_at: datetime | None
    last_error: str | None
    error_count_1h: int
    throughput_per_min: float
    status: HealthStatus


class SourceHealthResponse(BaseModel):
    sources: list[SourceHealthDTO]


def _derive_status(last_error: str | None, err_count: int) -> HealthStatus:
    """Map (last_error, err_count) -> badge color.

    - 5+ errors in the last hour: failed
    - 1-4 errors with a last_error recorded: degraded
    - any non-zero error count: degraded
    - otherwise: healthy
    """
    if err_count >= 5:
        return "failed"
    if err_count >= 1 and last_error is not None:
        return "degraded"
    if err_count > 0:
        return "degraded"
    return "healthy"


@router.get("/health", response_model=SourceHealthResponse)
async def sources_health(
    _user: User = Depends(require_user),
) -> SourceHealthResponse:
    async with async_session()() as s:
        sources = (await s.scalars(select(Source))).all()
        states = {fs.source_id: fs for fs in (await s.scalars(select(FeedState))).all()}

    redis = get_redis()
    out: list[SourceHealthDTO] = []
    for src in sources:
        fs = states.get(src.source_id)
        tput = await get_throughput(redis, src.source_id, window_s=60)
        err1h = await get_error_count_1h(redis, src.source_id)
        last_err = fs.last_error if fs else None
        status = _derive_status(last_err, err1h)
        out.append(
            SourceHealthDTO(
                source_id=src.source_id,
                source_type=src.source_type,
                enabled=src.enabled,
                last_fetch_at=fs.last_fetch_at if fs else None,
                last_success_at=fs.last_success_at if fs else None,
                last_error=last_err,
                error_count_1h=err1h,
                throughput_per_min=tput,
                status=status,
            )
        )
    return SourceHealthResponse(sources=out)
