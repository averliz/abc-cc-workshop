from __future__ import annotations

from datetime import datetime, timezone

import pytest
import fakeredis.aioredis as fr

from src.pipeline.metrics import get_throughput, record_fetch
from src.pipeline.publisher import BROADCAST_CHANNEL, STREAM, publish
from src.schemas.signal import Provenance, SignalEvent


def _ev(id_: str = "a" * 64, sid: str = "rss:t") -> SignalEvent:
    now = datetime.now(timezone.utc)
    return SignalEvent(
        id=id_,
        source_item_id="x",
        timestamp=now,
        content="hi",
        provenance=Provenance(
            source_id=sid,
            source_type="rss",
            source_url="https://e.com/",
            fetched_at=now,
            ingested_at=now,
        ),
    )


@pytest.mark.asyncio
async def test_first_publish_true_second_false():
    r = fr.FakeRedis(decode_responses=True)
    ev = _ev()
    assert await publish(r, ev) is True
    assert await publish(r, ev) is False
    await r.aclose()


@pytest.mark.asyncio
async def test_publish_xadds_to_signals_stream():
    r = fr.FakeRedis(decode_responses=True)
    ev = _ev("b" * 64)
    await publish(r, ev)
    assert await r.xlen(STREAM) == 1
    entries = await r.xrange(STREAM, count=1)
    assert len(entries) == 1
    _id, fields = entries[0]
    assert "payload" in fields
    round_trip = SignalEvent.model_validate_json(fields["payload"])
    assert round_trip.id == ev.id
    await r.aclose()


@pytest.mark.asyncio
async def test_publish_publishes_to_channel():
    r = fr.FakeRedis(decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(BROADCAST_CHANNEL)
    # Drain the initial subscribe confirmation
    await pubsub.get_message(timeout=0.5)

    ev = _ev("c" * 64)
    await publish(r, ev)

    msg = await pubsub.get_message(timeout=1.0, ignore_subscribe_messages=True)
    assert msg is not None
    assert msg["channel"] == BROADCAST_CHANNEL
    round_trip = SignalEvent.model_validate_json(msg["data"])
    assert round_trip.id == ev.id
    await pubsub.unsubscribe(BROADCAST_CHANNEL)
    await pubsub.aclose()
    await r.aclose()


@pytest.mark.asyncio
async def test_dedupe_key_has_ttl():
    r = fr.FakeRedis(decode_responses=True)
    ev = _ev("d" * 64)
    await publish(r, ev)
    ttl = await r.ttl(f"dedupe:{ev.id}")
    assert 86000 < ttl <= 86400
    await r.aclose()


@pytest.mark.asyncio
async def test_get_throughput_reports_items_per_minute():
    r = fr.FakeRedis(decode_responses=True)
    # Record 12 items this minute — expected throughput = 12 items/minute over 60s window.
    await record_fetch(r, "rss:tput", ok=True, items_emitted=12)
    tput = await get_throughput(r, "rss:tput", window_s=60)
    # Should be 12 ± small tolerance
    assert 11.0 <= tput <= 12.5
    await r.aclose()


@pytest.mark.asyncio
async def test_record_fetch_increments_error_counter_on_failure():
    r = fr.FakeRedis(decode_responses=True)
    await record_fetch(r, "rss:err", ok=False, items_emitted=0)
    await record_fetch(r, "rss:err", ok=False, items_emitted=0)
    from src.pipeline.metrics import get_error_count_1h

    assert await get_error_count_1h(r, "rss:err") == 2
    await r.aclose()
