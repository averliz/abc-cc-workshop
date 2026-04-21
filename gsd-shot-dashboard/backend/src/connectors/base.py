from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from typing import AsyncIterator, Literal, Protocol, runtime_checkable
from src.schemas.signal import SignalEvent

HealthStatus = Literal["healthy", "degraded", "failed"]


@dataclass
class SourceHealth:
    source_id: str
    last_success_at: datetime | None
    last_error: str | None
    error_count_1h: int
    throughput_per_min: float
    status: HealthStatus


@runtime_checkable
class SourceConnector(Protocol):
    source_id: str
    poll_interval_s: int

    async def fetch(self) -> AsyncIterator[SignalEvent]:
        """Yield normalized SignalEvent instances. Exceptions propagate to the scheduler."""
        ...

    async def health(self) -> SourceHealth: ...
