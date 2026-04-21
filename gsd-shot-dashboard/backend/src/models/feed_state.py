from __future__ import annotations
from datetime import datetime
from sqlalchemy import Text, Integer, Float, TIMESTAMP, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from src.models import Base


class FeedState(Base):
    __tablename__ = "feed_state"
    source_id: Mapped[str] = mapped_column(Text, ForeignKey("sources.source_id", ondelete="CASCADE"), primary_key=True)
    etag: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_modified: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_fetch_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_count_1h: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    throughput_per_min: Mapped[float] = mapped_column(Float, server_default="0", nullable=False)
