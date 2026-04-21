from datetime import datetime, timezone
import pytest
from pydantic import ValidationError
from src.schemas.signal import SignalEvent, Provenance
from src.connectors.base import SourceConnector


def _prov() -> Provenance:
    now = datetime.now(timezone.utc)
    return Provenance(
        source_id="rss:test", source_type="rss",
        source_url="https://example.com/feed",
        fetched_at=now, ingested_at=now, confidence=1.0,
    )


def test_signal_event_minimal_valid():
    now = datetime.now(timezone.utc)
    ev = SignalEvent(id="a"*64, source_item_id="abc", timestamp=now, content="hi", provenance=_prov())
    assert ev.tags == []
    assert ev.author is None
    assert ev.raw is None


def test_signal_event_requires_provenance():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        SignalEvent(id="x", source_item_id="y", timestamp=now, content="z")  # type: ignore[call-arg]


def test_provenance_rejects_non_url():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        Provenance(source_id="a", source_type="rss", source_url="not-a-url",
                   fetched_at=now, ingested_at=now)


def test_model_dump_excludes_raw():
    now = datetime.now(timezone.utc)
    ev = SignalEvent(id="a"*64, source_item_id="abc", timestamp=now, content="hi",
                     provenance=_prov(), raw={"debug": "data"})
    payload = ev.model_dump(exclude={"raw"}, mode="json")
    assert "raw" not in payload


def test_make_id_deterministic():
    a = SignalEvent.make_id("rss:test", "guid-1")
    b = SignalEvent.make_id("rss:test", "guid-1")
    assert a == b
    assert len(a) == 64


def test_source_connector_protocol_runtime_check():
    class GoodConn:
        source_id = "rss:demo"
        poll_interval_s = 60
        async def fetch(self):
            if False: yield
        async def health(self):
            ...

    class BadConn:
        source_id = "rss:demo"
        poll_interval_s = 60
        # missing fetch + health

    assert isinstance(GoodConn(), SourceConnector)
    assert not isinstance(BadConn(), SourceConnector)
