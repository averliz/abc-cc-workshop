from __future__ import annotations
from datetime import datetime
from typing import Any
from sqlalchemy import Text, TIMESTAMP, Float
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from src.models import Base
from src.schemas.signal import SignalEvent


class Signal(Base):
    __tablename__ = "signals"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    ingested_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), primary_key=True)
    source_item_id: Mapped[str] = mapped_column(Text, nullable=False)
    source_id: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    ts: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    author: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, server_default="1.0", nullable=False)
    raw: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    @classmethod
    def from_event(cls, ev: SignalEvent) -> "Signal":
        return cls(
            id=ev.id,
            ingested_at=ev.provenance.ingested_at,
            source_item_id=ev.source_item_id,
            source_id=ev.provenance.source_id,
            source_type=ev.provenance.source_type,
            source_url=str(ev.provenance.source_url),
            ts=ev.timestamp,
            author=ev.author,
            title=ev.title,
            content=ev.content,
            tags=list(ev.tags),
            confidence=ev.provenance.confidence,
            raw=ev.raw,
        )
