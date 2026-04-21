from __future__ import annotations
import hashlib
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, HttpUrl, ConfigDict


class Provenance(BaseModel):
    model_config = ConfigDict(frozen=True)
    source_id: str                  # e.g. "rss:bbc-world"
    source_type: str                # "rss" | "reddit" | "hn" | ...
    source_url: HttpUrl             # link back to original item
    fetched_at: datetime            # when WE fetched it
    ingested_at: datetime           # when WE inserted into DB
    confidence: float = 1.0         # 0-1, single-source = 1.0


class SignalEvent(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str = Field(..., description="sha256(source_id:source_item_id)")
    source_item_id: str
    timestamp: datetime             # source-reported event time
    author: str | None = None
    title: str | None = None
    content: str
    tags: list[str] = Field(default_factory=list)
    provenance: Provenance
    raw: dict[str, Any] | None = None

    @staticmethod
    def make_id(source_id: str, source_item_id: str) -> str:
        return hashlib.sha256(f"{source_id}:{source_item_id}".encode("utf-8")).hexdigest()
