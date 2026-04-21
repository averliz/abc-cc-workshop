---
phase: 01-vertical-slice-rss-end-to-end
plan: 03
subsystem: ingestion-pipeline
tags: [rss, feedparser, httpx, redis-streams, pubsub, consumer-groups, apscheduler, timescaledb, alembic, tdd]

requires:
  - "Plan 01-01: users/sources/feed_state tables + signals hypertable + Settings with DATABASE_URL + REDIS_URL"
  - "Plan 01-02: SignalEvent + Provenance schemas, SourceConnector Protocol, Signal ORM + Signal.from_event, connector registry, get_redis, async_session"
provides:
  - "RSSConnector (INGS-01) — feedparser + httpx async connector implementing SourceConnector Protocol with conditional GET (If-None-Match + If-Modified-Since) and FeedState round-trip via pg_insert().on_conflict_do_update()"
  - "publisher.publish(redis, ev) -> bool — SETNX dedupe (24h TTL) + XADD 'signals' (MAXLEN~100000) + PUBLISH 'signals:new' (PIPE-01 entrypoint)"
  - "Pipeline constants for Plan 04 SSE consumer: STREAM='signals', BROADCAST_CHANNEL='signals:new', PERSIST_GROUP='persist', BROADCAST_GROUP='broadcast'"
  - "run_persister(redis, stop) — xreadgroup(persist, persist-1, block=5000) -> Signal.from_event -> s.merge -> XACK-after-commit (idempotent upsert)"
  - "run_broadcaster(redis, stop) — separate consumer group re-publishes payload to signals:new Pub/Sub so DB backpressure cannot starve SSE fanout"
  - "worker.py — AsyncIOScheduler(UTC) with max_instances=1/coalesce=True per source + asyncio.gather(persister, broadcaster) as single container process"
  - "metrics helpers — record_fetch (ZSET of emit timestamps + 1h error counter), get_throughput (sliding window -> items/minute), get_error_count_1h"
  - "Seed migration 0003 — 'rss:bbc-world' in sources table (ON CONFLICT DO NOTHING) so docker compose up produces visible signal flow on first boot"
  - "docker-compose 'worker' service — python -m src.worker, depends on db+redis healthchecks + backend (which runs migrations)"
  - "Integration test @pytest.mark.integration — publish -> assert signals row within 10s AND broadcast message on signals:new"
  - "Pitfall 9 grep guard — test ensures feedparser is imported ONLY inside src/connectors/rss.py"
affects: [01-04, 01-05]

tech-stack:
  added:
    - "fakeredis>=2.25,<3 (dev-only) — XADD/XLEN/XRANGE/ZADD/PUBSUB all work without a live Redis; unit tests exercise real publish() and record_fetch() logic"
  patterns:
    - "Two-consumer-group split (RESEARCH §Pattern 3): 'persist' (DB writes) and 'broadcast' (Pub/Sub fanout) read the same 'signals' stream independently — DB slowness NEVER blocks SSE latency, Pub/Sub drops NEVER block persistence"
    - "ACK-after-commit: persister XACKs only after transaction commit; on DB failure the entry stays pending and is redelivered on next xreadgroup cycle"
    - "s.merge() on composite PK (id, ingested_at) is the idempotent upsert path that tolerates at-least-once redelivery without uniqueness violations"
    - "SETNX with TTL in Redis is the dedupe cache surface — survives worker restart (Pitfall 2), avoids a roundtrip to Postgres for every item"
    - "Conditional GET with FeedState-backed ETag / Last-Modified — Pitfall 5, state survives worker restart and cuts bandwidth on unchanged feeds (304 path)"
    - "feedparser isolated to connectors/rss.py (Pitfall 9) — downstream modules only see SignalEvent, never FeedParserDict; enforced by a grep-based unit test"
    - "JSON-safe raw filter — feedparser entries contain non-serializable objects; connector filters entry.items() to primitive types so model_dump_json() never explodes downstream"
    - "URL fallback guard — feedparser synthesizes link from guid for malformed items; connector checks for http/https prefix and falls back to feed_url to keep Provenance.source_url valid"
    - "APScheduler interval jobs with max_instances=1 + coalesce=True — overlapping fetches coalesce into one, preventing Redis dedupe thrash during slow 60s fetches"

key-files:
  created:
    - "backend/src/connectors/rss.py"
    - "backend/src/pipeline/__init__.py"
    - "backend/src/pipeline/publisher.py"
    - "backend/src/pipeline/metrics.py"
    - "backend/src/pipeline/persister.py"
    - "backend/src/pipeline/broadcaster.py"
    - "backend/src/worker.py"
    - "backend/alembic/versions/0003_seed_rss_source.py"
    - "backend/tests/unit/test_rss_connector.py"
    - "backend/tests/unit/test_publisher.py"
    - "backend/tests/integration/test_pipeline_end_to_end.py"
  modified:
    - "backend/pyproject.toml (added fakeredis>=2.25,<3 to dev group)"
    - "backend/uv.lock (regenerated)"
    - "docker-compose.yml (added 'worker' service)"

key-decisions:
  - "fakeredis chosen over testcontainers.redis for publisher unit tests — v2.35 supports XADD/XRANGE/ZADD/PUBSUB fully; tests run in <1s vs. container bring-up cost. testcontainers still used for the integration smoke test."
  - "Persister uses Session.merge (not INSERT ON CONFLICT) because composite hypertable PK + SQLAlchemy ORM makes merge the clean idempotent path; at-least-once redelivery becomes a no-op instead of a duplicate-key error."
  - "XACK happens AFTER commit (not before) — if the DB transaction fails, the message stays in the pending-entries list for next xreadgroup cycle, giving us built-in retry without explicit dead-letter handling in this phase."
  - "Broadcaster is a separate consumer group, not a passthrough in the persister — Pattern 3. Collapsing them would couple 5s SSE SLA to DB latency."
  - "Rule 1 bug fix during Task 1: feedparser synthesizes a bogus `link` from `<guid>` for malformed entries (e.g. 'ok-1'), which breaks Provenance.source_url (HttpUrl). Fixed by gating on `startswith(('http://', 'https://'))` and falling back to feed_url. Documented in the test fixture."
  - "Empty src/pipeline/__init__.py (not re-exports) — explicit imports (`from src.pipeline.publisher import publish`) avoid import cycles when worker.py imports all three pipeline modules."

artifacts:
  path: ".planning/phases/01-vertical-slice-rss-end-to-end/01-03-SUMMARY.md"

metrics:
  duration: "~6 minutes"
  completed: "2026-04-20"
  tasks: 3
  files_created: 11
  files_modified: 3
  commits: 5
  unit_tests_passing: 26
---

# Phase 01 Plan 03: RSS Connector + Pipeline (Publisher + Persister + Broadcaster + Worker) Summary

**One-liner:** End-to-end ingestion pipeline wired — feedparser+httpx RSS connector emits SignalEvents into a Redis Stream (`signals`) deduped by SETNX, consumed independently by a persister consumer group (`persist` -> TimescaleDB hypertable via `Signal.from_event`) and a broadcaster consumer group (`broadcast` -> `signals:new` Pub/Sub) so the 5s SSE SLA is decoupled from DB latency.

## What Was Built

### Pipeline Data Flow

```
                                   +--------------------+
 APScheduler (60s) ──▶ poll_once ─▶│ RSSConnector.fetch │
                                   +--------------------+
                                              │   yields SignalEvent
                                              ▼
                                  +--------------------+
                                  │ publisher.publish  │  SETNX dedupe:{id} 24h
                                  +--------------------+  XADD signals MAXLEN~100k
                                              │           PUBLISH signals:new
                                              ▼
                                  +------------------+
                                  │ redis stream:    │
                                  │   "signals"      │
                                  +------------------+
                                    │             │
                     xreadgroup     │             │    xreadgroup
                     persist:>      │             │    broadcast:>
                                    ▼             ▼
                       +----------------+   +---------------------+
                       │ run_persister  │   │ run_broadcaster     │
                       │ Signal.from_   │   │ redis.publish(      │
                       │   event        │   │   'signals:new',    │
                       │ s.merge        │   │   payload)          │
                       │ XACK (after    │   │ XACK                │
                       │  commit)       │   │                     │
                       +----------------+   +---------------------+
                               │                      │
                               ▼                      ▼
                       ┌───────────────┐      ┌────────────────────┐
                       │ TimescaleDB   │      │ Pub/Sub subscribers│
                       │ signals       │      │ (Plan 04 SSE)      │
                       │ hypertable    │      │                    │
                       └───────────────┘      └────────────────────┘
```

### Stream / Group / Channel Names (for Plan 04 SSE consumer)

| Constant                             | Value           | Source module                   |
|--------------------------------------|-----------------|---------------------------------|
| `STREAM`                             | `"signals"`     | `src.pipeline.publisher`        |
| `BROADCAST_CHANNEL`                  | `"signals:new"` | `src.pipeline.publisher`        |
| `DEDUPE_TTL_S`                       | `86400`         | `src.pipeline.publisher`        |
| `STREAM_MAXLEN`                      | `100_000`       | `src.pipeline.publisher`        |
| `PERSIST_GROUP` / `PERSIST_CONSUMER` | `"persist"` / `"persist-1"` | `src.pipeline.persister` |
| `BROADCAST_GROUP` / `BROADCAST_CONSUMER` | `"broadcast"` / `"broadcast-1"` | `src.pipeline.broadcaster` |

Plan 04's SSE handler should subscribe to `BROADCAST_CHANNEL` (import the constant from `src.pipeline.publisher` — do NOT hardcode the string).

## Key Decisions

See `key-decisions` in frontmatter. Principal architectural commitment: the two-consumer-group split (persist + broadcast). Collapsing them into one would couple the 5-second freshness constraint (PROJECT.md) to Postgres write latency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] URL fallback when feedparser synthesizes link from guid**
- **Found during:** Task 1 (RSSConnector GREEN phase)
- **Issue:** `test_fetch_skips_entry_without_id_link_title` blew up with `pydantic_core.ValidationError: source_url Input should be a valid URL`. Cause: feedparser is forgiving — when `<link>` is absent but `<guid>ok-1</guid>` exists, feedparser synthesizes `entry["link"] == "ok-1"`. That non-URL string propagates into `Provenance(source_url=link)` and fails HttpUrl validation.
- **Fix:** Guard the link with `startswith(("http://", "https://"))`; otherwise fall back to `self.feed_url` (which is always an absolute URL at construction time).
- **Files modified:** `backend/src/connectors/rss.py`
- **Commit:** `da832bb`

Otherwise: plan executed exactly as written.

### Authentication Gates

None — this plan has no external API credentials or manual gates.

## Commands to Run the Worker

```bash
# From repo root (gsd-shot-dashboard/)
docker compose up -d db redis
cd backend
uv run alembic upgrade head         # applies 0001, 0002, 0003 (BBC World seed)
uv run python -m src.worker         # runs scheduler + persister + broadcaster
```

Or via Docker Compose:
```bash
docker compose up -d db redis backend   # backend runs migrations on start
docker compose up -d worker             # worker picks up seeded sources
```

### Smoke verification (after ~90s)

```bash
docker compose exec redis redis-cli XLEN signals
#  -> should be >= 1 once BBC World polling cycle completes

docker compose exec db psql -U osint -d osint -c "SELECT count(*) FROM signals;"
#  -> should match XLEN (persister has drained the stream)

docker compose exec db psql -U osint -d osint -c "SELECT source_id, last_success_at, etag FROM feed_state;"
#  -> rss:bbc-world should have non-null etag + last_success_at
```

## Test Invocation

### Unit (no infra)

```bash
cd backend
uv run pytest tests/unit -x -q
# Expected: 26 passed
```

Covers: Plan 01-01/02 schema + auth (existing 13), plus this plan's 13 new tests:
- `test_rss_connector.py` — 7 tests (3-event fixture, 304, ETag persistence, skip malformed, bozo warning, Protocol isinstance, Pitfall 9 grep guard)
- `test_publisher.py` — 6 tests (dedupe T/F, XADD + round-trip, PUBLISH to channel, TTL, throughput ZSET, error counter)

### Integration (live Postgres + Redis)

```bash
cd backend
docker compose up -d db redis
uv run alembic upgrade head
uv run pytest -m integration -x -q
# Includes:
#   tests/integration/test_auth_flow.py         (Plan 01-02)
#   tests/integration/test_pipeline_end_to_end.py (THIS plan)
```

The pipeline integration test:
1. Trims the `signals` stream clean
2. Deletes any stale `rss:it-test` rows from `signals`
3. Starts persister + broadcaster as asyncio tasks
4. Subscribes to `signals:new`
5. Calls `publish(r, ev)` — asserts True
6. Polls DB up to 10s for the `signals` row
7. Polls pubsub up to 10s for a broadcast message
8. Cancels tasks cleanly

### Pipeline import smoke (fast, no infra)

```bash
cd backend
uv run python -c "from src.pipeline.persister import run_persister, PERSIST_GROUP; \
                  from src.pipeline.broadcaster import run_broadcaster, BROADCAST_GROUP; \
                  from src.worker import main, poll_once, load_sources; \
                  assert PERSIST_GROUP == 'persist' and BROADCAST_GROUP == 'broadcast'; \
                  print('pipeline imports ok')"
```

## Known Stubs

None. All wiring is real:
- `RSSConnector.fetch` makes real HTTP requests and parses real feeds.
- `publish/persister/broadcaster` use live Redis + SQLAlchemy calls, not placeholders.
- The seeded BBC World feed URL is live and publicly accessible.
- `worker.main` runs the scheduler + consumer loops concurrently; no `TODO`s or mock data sources.

## Pitfalls Guarded

| Pitfall | Surface | Guard |
|---|---|---|
| 1 — hypertable PK must include partition column | Persister uses `Signal.from_event` which sets `(id, ingested_at)` composite PK from migration 0002 | ORM PK matches migration |
| 2 — dedupe must survive restart | `redis.set(dedupe:{id}, nx=True, ex=86400)` — lives in Redis, survives worker restart | Covered by `test_first_publish_true_second_false` |
| 4 — feedparser `bozo` warnings shouldn't crash | Logger WARNING, no raise, partial entries still yielded | Covered by `test_bozo_feed_logs_warning_but_does_not_raise` |
| 5 — ETag / Last-Modified must persist across restarts | `pg_insert().on_conflict_do_update()` into `feed_state` | Covered by `test_fetch_persists_etag_and_last_modified` |
| 9 — feedparser types must not leak past the connector | Grep-based unit test + JSON-safe `raw` filter in connector | `test_feedparser_only_imported_in_rss_connector` |
| 10 — Streams must have MAXLEN so they don't grow forever | `xadd(..., maxlen=100_000, approximate=True)` | Code + constant in `publisher.py` |
| 11 — `create_hypertable` requires TimescaleDB image | `timescale/timescaledb:latest-pg17` in compose (from Plan 01-01) | Inherited |

## Files

### Created
- `backend/src/connectors/rss.py`
- `backend/src/pipeline/__init__.py`
- `backend/src/pipeline/publisher.py`
- `backend/src/pipeline/metrics.py`
- `backend/src/pipeline/persister.py`
- `backend/src/pipeline/broadcaster.py`
- `backend/src/worker.py`
- `backend/alembic/versions/0003_seed_rss_source.py`
- `backend/tests/unit/test_rss_connector.py`
- `backend/tests/unit/test_publisher.py`
- `backend/tests/integration/test_pipeline_end_to_end.py`

### Modified
- `backend/pyproject.toml` — added `fakeredis>=2.25,<3` to `[dependency-groups].dev`
- `backend/uv.lock` — regenerated for fakeredis + sortedcontainers
- `docker-compose.yml` — added `worker` service

## Commits

| Commit   | Type  | Description                                                              |
|----------|-------|--------------------------------------------------------------------------|
| `3723e06` | test  | Failing tests for RSSConnector (7 tests incl. Pitfall 9 grep guard)       |
| `da832bb` | feat  | RSSConnector GREEN — feedparser+httpx + FeedState round-trip + URL fix   |
| `4a34dec` | test  | Failing publisher + metrics tests, pin fakeredis                         |
| `a438002` | feat  | Publisher + metrics GREEN — SETNX dedupe + XADD + Pub/Sub + throughput ZSET |
| `c07aac4` | feat  | Persister + broadcaster + worker + seed migration + integration test     |

## Self-Check: PASSED

All claimed files exist:
- `backend/src/connectors/rss.py` FOUND
- `backend/src/pipeline/publisher.py` FOUND
- `backend/src/pipeline/metrics.py` FOUND
- `backend/src/pipeline/persister.py` FOUND
- `backend/src/pipeline/broadcaster.py` FOUND
- `backend/src/worker.py` FOUND
- `backend/alembic/versions/0003_seed_rss_source.py` FOUND
- `backend/tests/unit/test_rss_connector.py` FOUND
- `backend/tests/unit/test_publisher.py` FOUND
- `backend/tests/integration/test_pipeline_end_to_end.py` FOUND

All commits present in `git log`:
- `3723e06` FOUND
- `da832bb` FOUND
- `4a34dec` FOUND
- `a438002` FOUND
- `c07aac4` FOUND

Test suite: `uv run pytest tests/unit -x -q` -> **26 passed**.

Import smoke: `uv run python -c "from src.pipeline.persister ..."` -> **pipeline imports ok**.
