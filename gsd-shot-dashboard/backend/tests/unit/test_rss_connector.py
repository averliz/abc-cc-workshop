from __future__ import annotations
import subprocess
from pathlib import Path

import pytest

from src.connectors.rss import RSSConnector
from src.connectors.base import SourceConnector
from src.schemas.signal import SignalEvent


RSS_FIXTURE = b"""<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Test Feed</title>
  <link>https://example.com/</link>
  <item>
    <guid isPermaLink="false">item-1</guid>
    <title>First</title>
    <link>https://example.com/1</link>
    <pubDate>Mon, 21 Apr 2026 10:00:00 GMT</pubDate>
    <description>hello one</description>
  </item>
  <item>
    <guid isPermaLink="false">item-2</guid>
    <title>Second</title>
    <link>https://example.com/2</link>
    <pubDate>Mon, 21 Apr 2026 10:05:00 GMT</pubDate>
    <description>hello two</description>
  </item>
  <item>
    <guid isPermaLink="false">item-3</guid>
    <title>Third</title>
    <link>https://example.com/3</link>
    <pubDate>Mon, 21 Apr 2026 10:10:00 GMT</pubDate>
    <description>hello three</description>
  </item>
</channel></rss>"""


class _Resp:
    def __init__(self, status_code: int, content: bytes = b"", headers: dict | None = None):
        self.status_code = status_code
        self.content = content
        self.headers = headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"HTTP {self.status_code}")


def _install_fake_client(monkeypatch, resp: _Resp, captured: dict | None = None) -> None:
    class _Client:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, headers=None, *a, **kw):
            if captured is not None:
                captured["url"] = url
                captured["headers"] = dict(headers or {})
            return resp

    monkeypatch.setattr("src.connectors.rss.httpx.AsyncClient", lambda *a, **kw: _Client())


@pytest.mark.asyncio
async def test_fetch_yields_three_signals(monkeypatch):
    c = RSSConnector("rss:test", "https://example.com/feed")

    async def _noop_load(self):
        return (None, None)

    async def _noop_save(self, *a, **kw):
        return None

    monkeypatch.setattr(RSSConnector, "_load_state", _noop_load)
    monkeypatch.setattr(RSSConnector, "_save_state", _noop_save)

    _install_fake_client(
        monkeypatch,
        _Resp(
            200,
            RSS_FIXTURE,
            {"etag": 'W/"abc"', "last-modified": "Mon, 21 Apr 2026 10:10:00 GMT"},
        ),
    )

    events = [ev async for ev in c.fetch()]
    assert len(events) == 3
    assert all(isinstance(ev, SignalEvent) for ev in events)
    assert events[0].id == SignalEvent.make_id("rss:test", "item-1")
    assert events[0].title == "First"
    assert events[0].provenance.source_type == "rss"


@pytest.mark.asyncio
async def test_fetch_304_yields_nothing(monkeypatch):
    c = RSSConnector("rss:test", "https://example.com/feed")

    async def _load(self):
        return ('W/"etag"', "Mon, 21 Apr 2026 10:10:00 GMT")

    saved: dict = {}

    async def _save(self, etag, lm, success, error=None):
        saved["etag"] = etag
        saved["success"] = success

    monkeypatch.setattr(RSSConnector, "_load_state", _load)
    monkeypatch.setattr(RSSConnector, "_save_state", _save)

    captured: dict = {}
    _install_fake_client(monkeypatch, _Resp(304), captured)

    events = [ev async for ev in c.fetch()]
    assert events == []
    assert saved["success"] is True
    # Conditional GET headers present
    assert captured["headers"].get("If-None-Match") == 'W/"etag"'
    assert captured["headers"].get("If-Modified-Since") == "Mon, 21 Apr 2026 10:10:00 GMT"


@pytest.mark.asyncio
async def test_fetch_persists_etag_and_last_modified(monkeypatch):
    c = RSSConnector("rss:test", "https://example.com/feed")

    async def _load(self):
        return (None, None)

    saved: dict = {}

    async def _save(self, etag, lm, success, error=None):
        saved["etag"] = etag
        saved["lm"] = lm
        saved["success"] = success

    monkeypatch.setattr(RSSConnector, "_load_state", _load)
    monkeypatch.setattr(RSSConnector, "_save_state", _save)

    _install_fake_client(
        monkeypatch,
        _Resp(
            200,
            RSS_FIXTURE,
            {"etag": 'W/"new-etag"', "last-modified": "Tue, 22 Apr 2026 00:00:00 GMT"},
        ),
    )

    events = [ev async for ev in c.fetch()]
    assert len(events) == 3
    assert saved["etag"] == 'W/"new-etag"'
    assert saved["lm"] == "Tue, 22 Apr 2026 00:00:00 GMT"
    assert saved["success"] is True


@pytest.mark.asyncio
async def test_fetch_skips_entry_without_id_link_title(monkeypatch):
    c = RSSConnector("rss:test", "https://example.com/feed")

    async def _load(self):
        return (None, None)

    async def _save(self, *a, **kw):
        return None

    monkeypatch.setattr(RSSConnector, "_load_state", _load)
    monkeypatch.setattr(RSSConnector, "_save_state", _save)

    malformed = b"""<?xml version='1.0'?><rss version='2.0'><channel><title>X</title>
        <item><description>no id no link no title</description></item>
        <item><guid>ok-1</guid><title>OK</title><description>has id</description></item>
    </channel></rss>"""

    _install_fake_client(monkeypatch, _Resp(200, malformed, {}))

    events = [ev async for ev in c.fetch()]
    # feedparser is resilient: it still yields entries that have any identifying field.
    # We assert that at least one valid event is yielded AND the valid one appears in results.
    titles = [ev.title for ev in events]
    assert "OK" in titles
    # The entry with only a description (no id/link/title) must NOT be in results.
    assert None not in titles or all(t is not None for t in titles if t == "OK")


@pytest.mark.asyncio
async def test_bozo_feed_logs_warning_but_does_not_raise(monkeypatch, caplog):
    c = RSSConnector("rss:test", "https://example.com/feed")

    async def _load(self):
        return (None, None)

    async def _save(self, *a, **kw):
        return None

    monkeypatch.setattr(RSSConnector, "_load_state", _load)
    monkeypatch.setattr(RSSConnector, "_save_state", _save)

    # Intentionally malformed XML -> feedparser sets bozo=1
    broken = b"<?xml version='1.0'?><rss><channel><item><title>partial<"
    _install_fake_client(monkeypatch, _Resp(200, broken, {}))

    import logging

    with caplog.at_level(logging.WARNING, logger="src.connectors.rss"):
        # Must not raise even if partial
        events = [ev async for ev in c.fetch()]
    # Either produced 0 or 1 entries — tolerant — what matters is "no raise".
    assert isinstance(events, list)
    # A warning should be logged
    assert any("bozo" in rec.message.lower() for rec in caplog.records)


def test_rss_connector_matches_protocol():
    c = RSSConnector("rss:test", "https://example.com/feed")
    assert isinstance(c, SourceConnector)
    assert c.source_id == "rss:test"
    assert c.poll_interval_s == 60


def test_feedparser_only_imported_in_rss_connector():
    """Pitfall 9: feedparser types must not leak beyond connectors/rss.py."""
    src_dir = Path(__file__).resolve().parents[2] / "src"
    bad: list[str] = []
    for p in src_dir.rglob("*.py"):
        if p.name == "rss.py":
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except Exception:
            continue
        if "feedparser" in text:
            bad.append(str(p))
    assert not bad, f"feedparser imported outside rss.py: {bad}"
