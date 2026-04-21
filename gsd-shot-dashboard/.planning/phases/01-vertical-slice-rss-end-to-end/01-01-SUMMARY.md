---
phase: 01-vertical-slice-rss-end-to-end
plan: 01
subsystem: infra
tags: [docker-compose, timescaledb, postgres, redis, caddy, alembic, uv, fastapi, sqlalchemy]

requires: []
provides:
  - "Docker Compose topology (timescale/timescaledb:latest-pg17, redis:7.4-alpine, caddy:2.8-alpine, backend build context, web stub)"
  - "Caddy reverse proxy on :8080 unifying /api → backend:8000 and / → web:3000 with SSE-friendly flush_interval -1 + 24h timeouts"
  - ".env.example with DATABASE_URL (async) + DATABASE_URL_SYNC (sync, for Alembic) + REDIS_URL + SESSION_SECRET"
  - "backend/ Python project via uv with pinned deps (fastapi 0.118+, sqlalchemy 2.0.36+, alembic 1.13+, feedparser 6.0.12, redis 6.4, itsdangerous, passlib[bcrypt])"
  - "backend/Dockerfile on python:3.12-slim (not alpine)"
  - "backend/src/config.py — Settings(BaseSettings) exporting get_settings() with @lru_cache"
  - "backend/src/db.py — get_engine() + async_session() factory"
  - "Alembic migration infrastructure (alembic.ini + env.py pulling DATABASE_URL_SYNC from Settings)"
  - "Migration 0001: users, sources, feed_state tables + CREATE EXTENSION timescaledb (Pitfall 11 closed)"
  - "Migration 0002: signals hypertable on ingested_at with composite PK (id, ingested_at) — Pitfall 1 closed — plus idx_signals_source_ts, idx_signals_ingested, and add_retention_policy('signals', INTERVAL '30 days')"
  - "scripts/smoke_env.sh — tool availability check"
  - "README.md — Quickstart / Services / Create first user / Development notes"
affects: [01-02, 01-03, 01-04, 01-05, 02, 03]

tech-stack:
  added:
    - "TimescaleDB 2.17 on Postgres 17 (docker image timescale/timescaledb:latest-pg17)"
    - "Redis 7.4-alpine"
    - "Caddy 2.8-alpine reverse proxy"
    - "Python 3.12 backend scaffolded via uv (pinned deps per RESEARCH.md §Standard Stack)"
    - "Alembic 1.13+ for schema versioning; migrations pull DATABASE_URL_SYNC from pydantic Settings"
  patterns:
    - "Single-origin reverse proxy (Caddy :8080) for dev + prod parity — closes Pitfalls 6/8/12"
    - "Two DB URLs: DATABASE_URL (asyncpg, runtime) + DATABASE_URL_SYNC (psycopg2, Alembic)"
    - "Composite hypertable PK (id, ingested_at) — partition column must be in PK (Pitfall 1)"
    - "CREATE EXTENSION timescaledb as first statement of first signals-touching migration (Pitfall 11)"
    - "feed_state in Postgres (not Redis) so conditional-GET state survives restart (Pitfall 5)"
    - "SSE-safe Caddy config: flush_interval -1, read_timeout 24h, write_timeout 24h (Pitfall 12)"

key-files:
  created:
    - "docker-compose.yml"
    - ".env.example"
    - ".gitignore"
    - "Caddyfile"
    - "scripts/smoke_env.sh"
    - "README.md"
    - "backend/pyproject.toml"
    - "backend/uv.lock"
    - "backend/Dockerfile"
    - "backend/src/__init__.py"
    - "backend/src/config.py"
    - "backend/src/db.py"
    - "backend/alembic.ini"
    - "backend/alembic/env.py"
    - "backend/alembic/script.py.mako"
    - "backend/alembic/versions/0001_init_users_sources.py"
    - "backend/alembic/versions/0002_signals_hypertable.py"
  modified: []

key-decisions:
  - "Pin timescale/timescaledb:latest-pg17 instead of vanilla postgres:17 — extension available by default (closes Pitfall 11 at image level too)"
  - "Added psycopg2-binary to backend deps because Alembic is sync-only and DATABASE_URL_SYNC needs a sync driver — SQLAlchemy default for postgresql:// is psycopg2"
  - "Caddy (not nginx/Traefik) for reverse proxy — 15-line Caddyfile is simpler and closes Pitfalls 6/8/12 with flush_interval -1 out of the box"
  - "Used composite PK (id, ingested_at) on signals from day 1 per RESEARCH.md Pitfall 1 — TimescaleDB requires partition column in any unique constraint"

patterns-established:
  - "GSD commit format: {type}({phase}-{plan}): {description} with bulleted change list and rationale"
  - "Env layering: single .env.example at project root feeds both docker-compose and uv-managed backend via pydantic-settings"
  - "Alembic migrations use op.execute('...') for Timescale-specific DDL (hypertable + retention); ORM-friendly DDL uses op.create_table"

requirements-completed: [FOUN-01, PIPE-02]

duration: 5 min
completed: 2026-04-20
---

# Phase 01 Plan 01: Infrastructure Foundation Summary

**Docker Compose + TimescaleDB + Redis + Caddy SSE-safe reverse proxy + Alembic signals hypertable with 30-day retention — vertical-slice substrate ready for backend/pipeline/frontend plans.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-20T17:39:40Z
- **Completed:** 2026-04-20T17:44:52Z
- **Tasks:** 3
- **Files created:** 17 (plus one host `.env` copy, not committed)

## Accomplishments

- Five-service Docker Compose stack (`db`, `redis`, `caddy`, `backend`, `web`) validated via `docker compose config` and proven to reach healthy state on `db` + `redis`.
- Caddy reverse proxy on `localhost:8080` unifies `/api` → FastAPI and `/` → Next.js with SSE-safe `flush_interval -1` and 24h read/write timeouts. Closes Pitfalls 6, 8, 12 before any SSE code exists.
- Backend project scaffolded with `uv` using RESEARCH.md-pinned versions; `Settings` and `async_session()` imports verified from the host.
- Alembic baseline migrations applied end-to-end against the live TimescaleDB container: `users`, `sources`, `feed_state`, and the `signals` hypertable with `PRIMARY KEY (id, ingested_at)` and a registered 30-day retention policy. Pitfalls 1 and 11 closed by construction.

## Task Commits

1. **Task 1: Docker Compose topology + env scaffolding + Caddy reverse proxy + smoke script + README** — `7dbb43b` (feat)
2. **Task 2: Backend Python scaffold (uv) + config + db session + Dockerfile** — `243803b` (feat)
3. **Task 3: Alembic migrations — users/sources/feed_state + signals hypertable with 30-day retention** — `0f1ad02` (feat)

**Plan metadata commit:** (to be appended — SUMMARY + STATE + ROADMAP)

## Files Created/Modified

**Project root:**
- `docker-compose.yml` — 5-service topology with healthchecks and timescale/redis pinning
- `Caddyfile` — `:80` vhost with `/api/*` → `backend:8000` (SSE-safe) and `/` → `web:3000`
- `.env.example` — env var template documenting every variable downstream plans need
- `.gitignore` — `.env`, `.venv`, `node_modules`, `.next`, `__pycache__`, tool caches
- `scripts/smoke_env.sh` — checks for docker, node, python, uv
- `README.md` — quickstart, services table, dev notes pointing users at Caddy origin

**Backend (`backend/`):**
- `pyproject.toml` — dependencies pinned per RESEARCH.md §Standard Stack; `[tool.pytest.ini_options]` with `asyncio_mode = "auto"`; `[tool.ruff]` `target-version = "py312"`
- `uv.lock` — generated by `uv sync`
- `Dockerfile` — `python:3.12-slim` base (not alpine), installs uv 0.5, runs `uv sync --frozen --no-dev`
- `src/__init__.py` — package marker (empty)
- `src/config.py` — `Settings(BaseSettings)` with `database_url`, `database_url_sync`, `redis_url`, `session_secret`, etc.; `get_settings()` wrapped in `@lru_cache(maxsize=1)`
- `src/db.py` — lazy `get_engine()` (async, pool_size=10, pool_pre_ping) and `async_session()` factory

**Alembic (`backend/alembic/`):**
- `alembic.ini` — `script_location = alembic`, empty `sqlalchemy.url` (set dynamically)
- `alembic/env.py` — imports `get_settings()` and sets `sqlalchemy.url = database_url_sync` at runtime
- `alembic/script.py.mako` — standard Alembic template
- `alembic/versions/0001_init_users_sources.py` — `CREATE EXTENSION IF NOT EXISTS timescaledb` first, then `users`, `sources`, `feed_state` tables (composite FK on feed_state.source_id)
- `alembic/versions/0002_signals_hypertable.py` — raw-SQL `CREATE TABLE signals` with `PRIMARY KEY (id, ingested_at)`, `SELECT create_hypertable(...)`, two indexes, `SELECT add_retention_policy('signals', INTERVAL '30 days')`

## Decisions Made

- **TimescaleDB image `timescale/timescaledb:latest-pg17`**: extension pre-installed, closing Pitfall 11 at the image layer. Vanilla `postgres:17` would require manual `pg_hba.conf` tweaks or `shared_preload_libraries`.
- **Caddy over nginx/Traefik**: 15-line Caddyfile is easier to reason about; `flush_interval -1` and long timeouts are single-line directives. Closes Pitfalls 6/8/12 at the proxy layer from Phase 1.
- **Composite hypertable PK `(id, ingested_at)`** baked into first signals migration per RESEARCH.md Pitfall 1. Any future unique constraint on signals must include `ingested_at`.
- **Two DATABASE_URLs** (async + sync): keeps runtime fast (asyncpg) while letting Alembic use the stock psycopg2 path. Both documented in `.env.example` so onboarding friction is zero.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `psycopg2-binary` to backend dependencies**
- **Found during:** Task 3 (running `uv run alembic upgrade head`)
- **Issue:** The plan specified `DATABASE_URL_SYNC=postgresql://...` and `env.py` feeds it into SQLAlchemy via Alembic, but the plan's `pyproject.toml` listed only `asyncpg` (driver for `postgresql+asyncpg://`). SQLAlchemy's default driver for a bare `postgresql://` URL is `psycopg2`, so Alembic would have failed at engine creation with `ModuleNotFoundError: psycopg2` or an equivalent DBAPI-not-found error.
- **Fix:** Added `"psycopg2-binary>=2.9,<3"` to `[project].dependencies` in `backend/pyproject.toml` and re-ran `uv sync`.
- **Files modified:** `backend/pyproject.toml`, `backend/uv.lock`
- **Verification:** `uv run alembic upgrade head` completes successfully against the running `db` container; `timescaledb_information.hypertables` shows `signals`; retention policy `drop_after = 30 days` confirmed.
- **Committed in:** `243803b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for Alembic to run at all. No scope creep — psycopg2-binary is purely a driver the plan implicitly required via `DATABASE_URL_SYNC`.

## Issues Encountered

None. All tasks executed with verification passing on first run after the psycopg2-binary deviation was resolved during dependency install.

## User Setup Required

None — no external service configuration required for this plan. Developer runs `cp .env.example .env` locally; no accounts, API keys, or dashboards to configure.

## Next Phase Readiness

- **Ready for Plan 02 (FastAPI app + SignalEvent schema + SourceConnector Protocol + auth):** `backend/src/config.py` and `backend/src/db.py` are importable; the `users` table exists so the auth CLI can INSERT the seed user; the project layout under `backend/src/` matches RESEARCH.md §Recommended Project Structure.
- **Ready for Plan 03 (pipeline):** Redis is running; `signals` hypertable exists; `feed_state` table exists for conditional-GET bookkeeping.
- **Ready for Plan 04 (API endpoints including SSE):** Caddy is already configured with SSE-safe timeouts. Browser → `http://localhost:8080/api/stream` will flow through with no buffering.
- **No blockers.**

## Self-Check: PASSED

All 18 claimed files exist on disk. All 3 task commits (`7dbb43b`, `243803b`, `0f1ad02`) exist in git history.

---
*Phase: 01-vertical-slice-rss-end-to-end*
*Completed: 2026-04-20*
