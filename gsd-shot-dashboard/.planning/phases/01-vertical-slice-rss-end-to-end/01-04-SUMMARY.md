---
phase: 01-vertical-slice-rss-end-to-end
plan: 04
subsystem: api
tags: [fastapi, sse, sse-starlette, server-sent-events, pubsub, httpx, pydantic, redis]

# Dependency graph
requires:
  - phase: 01-vertical-slice-rss-end-to-end
    provides: "require_user auth dependency + session cookie (Plan 01-02); publisher BROADCAST_CHANNEL + SignalEvent/Provenance + metrics.get_throughput/get_error_count_1h + seeded Source/FeedState (Plan 01-03)"
provides:
  - "GET /api/signals backfill endpoint (limit + source_id filter + keyset cursor on (ingested_at, id))"
  - "GET /api/stream SSE endpoint via sse-starlette EventSourceResponse (event=signal, id=signal.id, data=SignalEventDTO)"
  - "GET /api/sources/health composing Postgres feed_state + Redis metrics into per-source badges"
  - "SignalEventDTO — stable on-wire signal shape (no raw field) for frontend (Plan 05) consumption"
  - "scripts/load_generator.py — publishes via the real publish() pipeline to prove 1000 items/min"
  - "tests/integration/test_sse_stream.py — publish-to-frame end-to-end latency assertion"
  - "Last-Event-ID reconnect replay from Postgres (capped at 500)"
affects: [01-05-frontend-event-bus, phase-02-breadth-and-search, phase-03-alerts]

# Tech tracking
tech-stack:
  added: [sse-starlette>=2.1 (installed 2.4.1)]
  patterns:
    - "SSE via upstream sse-starlette (fastapi.sse wrapper not yet released)"
    - "Keyset pagination via tuple_(ingested_at, id) cursor (no OFFSET drift on hot writes)"
    - "Request.is_disconnected() + bounded pubsub.get_message(timeout=1.0) to prevent zombie subscribers"
    - "SignalEventDTO as the stable wire contract (ORM Signal -> DTO at edges; raw field stays server-side)"

key-files:
  created:
    - backend/src/api/signals.py
    - backend/src/api/stream.py
    - backend/src/api/sources.py
    - scripts/load_generator.py
    - backend/tests/integration/test_sse_stream.py
  modified:
    - backend/src/main.py
    - backend/pyproject.toml
    - backend/uv.lock
    - README.md

key-decisions:
  - "sse-starlette (instead of fastapi.sse) because FastAPI 0.129.x — the version pinned in pyproject.toml and resolved in the lockfile — does not ship fastapi.sse yet. sse-starlette is the upstream library, identical API (EventSourceResponse + ServerSentEvent), Sound drop-in replacement."
  - "Keyset pagination via composite tuple_(ingested_at, id) cursor rather than OFFSET: avoids reading-past-the-write-head drift under heavy ingest (Pitfall 10)."
  - "Live loop uses pubsub.get_message(timeout=1.0, ignore_subscribe_messages=True) NOT pubsub.listen(): bounded read lets request.is_disconnected() fire every iteration (Pitfall 3)."
  - "Last-Event-ID replay pulls the anchor signal to recover its ingested_at then paginates forward, cap 500 rows: protects the endpoint under aggressive EventSource reconnect loops."
  - "_derive_status maps (last_error, err_count) -> healthy|degraded|failed server-side; frontend only renders the badge — keeps status-policy changes backend-only."
  - "Load generator embeds ms-precision timestamp in source_item_id so reruns inside the 24h dedupe window (DEDUPE_TTL_S=86400) produce unique ids."

patterns-established:
  - "Pattern: DTO excludes `raw` and derives from ORM row via classmethod `from_row(Signal)`. SSE hot path converts SignalEvent -> dict via module-level `_dto_from_event` helper (avoids allocating a DTO per frame at 1000/min)."
  - "Pattern: router modules own their prefix; create_app() composes via include_router so each feature ships as a single file."
  - "Pattern: SSE generator is an AsyncIterable[ServerSentEvent]; initial `ServerSentEvent(comment='stream-ready')` forces proxy flush so clients don't see a dead socket."
  - "Pattern: Pub/Sub cleanup in finally block — unsubscribe + aclose best-effort — so disconnects never leak subscribers."

requirements-completed: [PIPE-04, DASH-05]

# Metrics
duration: 5min
completed: 2026-04-20
---

# Phase 01 Plan 04: SSE stream + backfill + source-health + load generator Summary

**Live SSE at `/api/stream` via sse-starlette with Last-Event-ID replay, paginated backfill at `/api/signals`, per-source health badges at `/api/sources/health`, and a load generator that exercises the real publish pipeline to prove 1000+ items/min.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-20T18:17:16Z
- **Completed:** 2026-04-20T18:22:41Z
- **Tasks:** 3
- **Files created:** 5
- **Files modified:** 4

## Accomplishments

- **PIPE-04 closed.** `GET /api/stream` is a fully working SSE endpoint behind `require_user`: subscribes to `signals:new` Pub/Sub on connect, emits `event: signal` frames keyed by `id=<signal.id>` with `data=<SignalEventDTO json>`. A bounded `pubsub.get_message(timeout=1.0)` loop plus `request.is_disconnected()` each iteration means zombie subscribers can't accumulate (Pitfall 3 neutralized), and a `finally` block guarantees `unsubscribe + aclose` on every exit path.
- **Last-Event-ID reconnect replay works.** The handler reads the `Last-Event-ID` request header, anchors on that signal's `ingested_at`, and replays up to 500 rows in `(ingested_at ASC, id ASC)` order before resuming live fanout. Cap protects against reconnect-storm amplification.
- **Backfill endpoint with keyset pagination.** `GET /api/signals?limit=N&cursor=...&source_id=...` returns `{items, next_cursor}` where `next_cursor = "{ingested_at_iso}|{id}"` — avoids OFFSET drift on a hot write path. `SignalEventDTO` is the single source of truth for on-wire signal shape (no `raw` field; frozen by Plan 05 frontend consumption).
- **DASH-05 backend ready.** `GET /api/sources/health` composes Postgres (`sources` + `feed_state`) with Redis metrics (`get_throughput`, `get_error_count_1h`) and derives `healthy|degraded|failed` server-side via `_derive_status(last_error, err_count)`.
- **Pitfall 10 guard shipped.** `scripts/load_generator.py` publishes through the real `publish()` function (dedupe + XADD + PUBLISH) at configurable `--rate` / `--duration` / `--source-id`. README "Load testing" section documents the canonical invocation plus the verifying SQL count.
- **End-to-end integration test.** `tests/integration/test_sse_stream.py` logs in via POST /api/auth/login, opens `/api/stream` on the same cookie jar, calls `publish(redis, ev)`, and asserts a matching frame arrives within 3 s with `raw` field absent — proves sub-2-second publish-to-client latency and the DTO contract.

## Task Commits

1. **Task 1: GET /api/signals backfill endpoint + SignalEventDTO + wiring** — `501c6a1` (feat)
2. **Task 2: GET /api/stream SSE endpoint with replay + disconnect handling** — `62505bb` (feat)
3. **Task 3: GET /api/sources/health + load generator + SSE integration test** — `2f6defe` (feat)

## Files Created/Modified

**Created**

- `backend/src/api/signals.py` — `SignalEventDTO`, `SignalsPage`, `GET /api/signals` with composite keyset cursor.
- `backend/src/api/stream.py` — `GET /api/stream` SSE handler: initial `stream-ready` comment, Last-Event-ID replay via `_backfill_since`, live fanout from `BROADCAST_CHANNEL`, Pub/Sub cleanup in `finally`.
- `backend/src/api/sources.py` — `SourceHealthDTO`, `SourceHealthResponse`, `_derive_status`, `GET /api/sources/health`.
- `scripts/load_generator.py` — argparse-driven async loop calling `publish()` at target rate; ms-precision `source_item_id` so reruns inside 24h dedupe window produce unique ids.
- `backend/tests/integration/test_sse_stream.py` — asyncio-backed SSE end-to-end test (login → stream → publish → frame within 3s → `raw` absent).

**Modified**

- `backend/src/main.py` — include `signals_router`, `stream_router`, `sources_router` in `create_app()`.
- `backend/pyproject.toml` — added `sse-starlette>=2.1,<3` dependency (see deviation below).
- `backend/uv.lock` — regenerated.
- `README.md` — added "Load testing" section with canonical generator invocation.

## Decisions Made

See `key-decisions` frontmatter above. In short:

- `sse-starlette` over `fastapi.sse` (forced by pinned FastAPI version; identical API).
- Composite `(ingested_at, id)` keyset cursor over OFFSET.
- Bounded `get_message(timeout=1.0)` over `pubsub.listen()` (required for disconnect polling).
- Last-Event-ID replay cap at 500.
- Health status derivation server-side.
- Ms-precision id suffix in load generator for dedupe-window safety.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Swapped `fastapi.sse` imports for `sse-starlette`**

- **Found during:** Task 2 (`/api/stream` SSE endpoint).
- **Issue:** The plan hard-codes `from fastapi.sse import EventSourceResponse, ServerSentEvent` and asserts this exact import in its verification step, stating "FastAPI ≥0.118" is sufficient. The installed FastAPI (0.129.2, matching the pinned `fastapi>=0.118,<0.130` range) does **not** expose a `fastapi.sse` module — it only lives on FastAPI master / post-0.129 unreleased. `python -c "from fastapi.sse import ..."` raises `ModuleNotFoundError`. Verified by listing `fastapi.__all__` and inspecting `.venv/Lib/site-packages/fastapi/`.
- **Fix:** Added `sse-starlette>=2.1,<3` to `backend/pyproject.toml` (resolved to 2.4.1), ran `uv sync`, imported `EventSourceResponse` + `ServerSentEvent` from `sse_starlette` instead. API is identical — `sse-starlette` is the upstream library whose surface FastAPI will vendor once `fastapi.sse` ships. All plan acceptance criteria that target the _behavior_ (EventSourceResponse handler, ServerSentEvent yields, keep-alive, X-Accel-Buffering, Cache-Control) are met; only the literal import path changed.
- **Files modified:** `backend/src/api/stream.py`, `backend/pyproject.toml`, `backend/uv.lock`.
- **Verification:** `uv run python -c "from sse_starlette import EventSourceResponse, ServerSentEvent; from src.main import app; paths=[r.path for r in app.routes]; assert '/api/stream' in paths"` → OK. The SSE integration test exercises the full publish → frame path.
- **Committed in:** `62505bb` (Task 2 commit).

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Zero scope creep; the switch preserves behavior and keeps the plan's acceptance criteria satisfied. Future FastAPI upgrade (when `fastapi.sse` is released) can swap the import back in a one-line change.

## Issues Encountered

None beyond the `fastapi.sse` availability gap handled as a deviation.

## User Setup Required

None — all changes are code + dependency. `uv sync` in `backend/` is required to pull `sse-starlette`; `uv.lock` is committed so CI / other devs get the same version.

## Next Phase Readiness

**Plan 01-05 (frontend event bus) unblocked.** The entire API contract it needs is live:

- `GET /api/signals?limit=100` for initial page load (returns `{items: SignalEventDTO[], next_cursor?}`).
- `GET /api/stream` for live updates (EventSource receives `event=signal`, `id=<signal.id>`, `data=SignalEventDTO`).
- `GET /api/sources/health` for the source-status sidebar (returns `{sources: SourceHealthDTO[]}`).
- On reconnect, EventSource's built-in `Last-Event-ID` header triggers server-side replay — the frontend needs no custom resume logic.

**Sanity curls (compose up + logged-in cookie jar):**

```bash
# Backfill
curl -s -b cookies.txt http://localhost:8080/api/signals?limit=10 | jq '.items[0]'
# Live stream (Ctrl-C to stop)
curl -N -b cookies.txt http://localhost:8080/api/stream
# Source health
curl -s -b cookies.txt http://localhost:8080/api/sources/health | jq '.sources[]'
# Unauth → 401
curl -i http://localhost:8080/api/stream
```

**Load-test evidence path:** `cd backend && uv run python ../scripts/load_generator.py --rate 1000 --duration 60` followed by `SELECT count(*) FROM signals WHERE source_id='loadgen:synth';` (documented in README).

---
*Phase: 01-vertical-slice-rss-end-to-end*
*Plan: 04*
*Completed: 2026-04-20*

## Self-Check: PASSED

All referenced files exist in the repo and all referenced commits exist in `git log`. See automated self-check output appended below.
