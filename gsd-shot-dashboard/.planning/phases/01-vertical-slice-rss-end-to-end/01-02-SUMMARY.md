---
phase: 01-vertical-slice-rss-end-to-end
plan: 02
subsystem: backend-core
tags: [fastapi, pydantic, sqlalchemy-orm, protocol, auth, bcrypt, itsdangerous, cli, httpx-testing]

requires:
  - "Plan 01-01: Settings + async_session + users/sources/feed_state tables + signals hypertable"
provides:
  - "Canonical SignalEvent + Provenance Pydantic models (FOUN-02) — frozen, HttpUrl-validated, with deterministic make_id(source_id, source_item_id) sha256 helper"
  - "SourceConnector Protocol (FOUN-03) — runtime_checkable contract: source_id/poll_interval_s/fetch()->AsyncIterator[SignalEvent]/health()->SourceHealth"
  - "SourceHealth dataclass — last_success_at, last_error, error_count_1h, throughput_per_min, status (healthy|degraded|failed)"
  - "Connector registry — register/all_connectors/get/clear for Phase 2/3 adapter authors"
  - "SQLAlchemy ORM models mirroring Plan 01-01 migrations — User, Source, FeedState, Signal (composite PK for hypertable)"
  - "Signal.from_event(SignalEvent) -> Signal row mapper — used by Plan 03 persister"
  - "Local auth endpoints (AUTH-01, AUTH-02): POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me"
  - "require_user FastAPI dependency — reads cookie, verifies signed token, loads User, raises 401 on any failure; ready for Plan 04 SSE endpoint"
  - "itsdangerous URLSafeTimedSerializer session cookies with salt 'osint.session.v1' — issue/verify helpers return int|None, never raise"
  - "passlib bcrypt hashing helpers (hash_password, verify_password)"
  - "src/redis_client.py — lazy aioredis client (decode_responses=True) + close_redis() for Plan 03 publisher"
  - "src/main.py — create_app() factory + lifespan that closes Redis on shutdown + /api/healthz smoke endpoint"
  - "src/cli/create_user.py — argparse CLI seeding the first analyst user with bcrypt-hashed password (detects duplicate)"
  - "tests/conftest.py — env defaults so Settings loads even without .env (for unit tests)"
  - "Integration test (tests/integration/test_auth_flow.py, @pytest.mark.integration) — full 401 -> login 200+cookie -> /me 200 -> logout 204 -> /me 401 cycle via httpx ASGITransport"
affects: [01-03, 01-04, 01-05]

tech-stack:
  added:
    - "email-validator 2.3 (runtime dependency of pydantic EmailStr — was not transitively pulled by pydantic>=2.9)"
  patterns:
    - "Runtime-checkable Protocol for the Source Adapter boundary — concrete classes don't subclass, they just match shape (RESEARCH.md §Pattern 1)"
    - "Frozen Pydantic models for SignalEvent + Provenance — signals are immutable events once produced (RESEARCH.md §Pattern 2)"
    - "Two-layer types: Pydantic SignalEvent at the adapter/bus boundary, SQLAlchemy Signal ORM only in the persister — connectors never see SQLAlchemy, persister never sees raw dicts"
    - "FastAPI Depends(require_user) for all cookie-protected endpoints — 401 on missing/invalid/expired/absent-user uniformly"
    - "Always call verify_password against something (even when user not found) to keep timing similar — no user-enumeration via login timing"
    - "Lazy module-level singletons (Redis client, DB engine, session factory) instead of DI containers — simpler, and async lifespan closes them on shutdown"
    - "ASGITransport integration tests — no uvicorn needed in CI; httpx speaks to FastAPI app directly while still exercising full middleware/cookie stack"

key-files:
  created:
    - "backend/src/schemas/__init__.py"
    - "backend/src/schemas/signal.py"
    - "backend/src/connectors/__init__.py"
    - "backend/src/connectors/base.py"
    - "backend/src/connectors/registry.py"
    - "backend/src/models/__init__.py"
    - "backend/src/models/user.py"
    - "backend/src/models/source.py"
    - "backend/src/models/feed_state.py"
    - "backend/src/models/signal.py"
    - "backend/src/auth/__init__.py"
    - "backend/src/auth/passwords.py"
    - "backend/src/auth/sessions.py"
    - "backend/src/auth/dependencies.py"
    - "backend/src/api/__init__.py"
    - "backend/src/api/auth.py"
    - "backend/src/redis_client.py"
    - "backend/src/main.py"
    - "backend/src/cli/__init__.py"
    - "backend/src/cli/create_user.py"
    - "backend/tests/__init__.py"
    - "backend/tests/conftest.py"
    - "backend/tests/unit/__init__.py"
    - "backend/tests/unit/test_signal_schema.py"
    - "backend/tests/unit/test_passwords.py"
    - "backend/tests/unit/test_sessions.py"
    - "backend/tests/integration/__init__.py"
    - "backend/tests/integration/test_auth_flow.py"
  modified:
    - "backend/pyproject.toml (added email-validator)"
    - "backend/uv.lock (regenerated)"
    - "README.md (Create first user section: docker compose + local uv commands)"

key-decisions:
  - "Added `email-validator>=2.2` to backend deps: pydantic EmailStr requires it at runtime and it was not transitively pulled by pydantic>=2.9 — Rule 3 blocking deviation"
  - "Session cookie salt is a fixed string constant ('osint.session.v1') rather than derived from Settings: salts do not need to be secret, only stable; versioning the salt gives us a clean rotation path if we ever need to invalidate all sessions"
  - "verify_session_cookie returns `int | None` instead of raising — callers (require_user, future SSE Last-Event-ID handler) treat missing/tampered/expired identically as unauthenticated, without exception-handling noise"
  - "Runtime-checkable Protocol (not ABC subclassing) for SourceConnector: adapters like the Plan 03 RSS connector just need to match shape; isinstance() check in registry gives duck-typed validation"
  - "Signal ORM model mirrors the raw-SQL hypertable exactly, including composite PK (id, ingested_at) required by TimescaleDB (Pitfall 1); Signal.from_event() is the single blessed path from Pydantic to ORM"
  - "CLI prints duplicate warning to stderr and returns existing id — idempotent re-runs won't error"
  - "Integration test uses httpx ASGITransport rather than spinning up uvicorn: faster, deterministic, still exercises cookies/middleware/routing end-to-end"

patterns-established:
  - "Test file pairing: every src/<module>.py has tests/unit/test_<module>.py when behavior is unit-testable"
  - "Integration tests gated by `@pytest.mark.integration` — `uv run pytest tests/unit -x -q` for fast feedback, `uv run pytest -m integration` when infra is up"
  - "conftest.py sets env defaults so unit tests never depend on a checked-in .env"

requirements-completed: [FOUN-02, FOUN-03, AUTH-01, AUTH-02]

metrics:
  duration: "~4 min"
  tasks: 3
  files_created: 28
  files_modified: 3
  completed: 2026-04-20
---

# Phase 01 Plan 02: Backend Core — SignalEvent + SourceConnector + Auth Summary

**Canonical SignalEvent/Provenance schema, runtime-checkable SourceConnector Protocol, bcrypt+itsdangerous local auth with httpOnly signed session cookies, FastAPI app entrypoint, and create-user CLI — the full backend contract that Plans 03/04/05 consume.**

## Performance

- **Duration:** ~4 min (17:50:37Z → 17:54:52Z UTC)
- **Tasks:** 3
- **Files created:** 28 source/test files
- **Files modified:** 3 (pyproject.toml, uv.lock, README.md)
- **Unit tests:** 13/13 passing (`tests/unit` — signal schema 6, passwords 4, sessions 3)

## Accomplishments

- **FOUN-02 (SignalEvent + Provenance)**: Frozen Pydantic v2 models with HttpUrl validation on `source_url`, deterministic sha256 id helper (`SignalEvent.make_id("rss:bbc", "guid-1")`), `raw` retained as optional JSONB-friendly `dict | None`. All six tests (valid minimal, missing provenance, non-URL rejection, `model_dump(exclude={"raw"})`, id determinism, Protocol runtime check) pass.
- **FOUN-03 (SourceConnector contract)**: `@runtime_checkable` Protocol with `source_id`, `poll_interval_s`, `async def fetch() -> AsyncIterator[SignalEvent]`, `async def health() -> SourceHealth`. Phase 2/3 adapters will just implement this shape — no ABC inheritance required. Registry exposes `register/all_connectors/get/clear`.
- **AUTH-01 (login)**: `POST /api/auth/login` verifies bcrypt hash, issues itsdangerous-signed cookie with configurable `httponly/secure/samesite/max_age` from Settings. Timing-ish: always calls `verify_password` even when user not found (mitigates user-enumeration via response-time deltas).
- **AUTH-02 (session persistence)**: `GET /api/auth/me` decodes the cookie and reloads the User — integration test proves the client re-sending the same cookie across requests returns 200 (the protocol-level "browser refresh" behavior). Cookie `max_age` = 7 days by default (per Settings).
- **CLI seeding**: `python -m src.cli.create_user --email analyst@local --password changeme` creates a user row with a bcrypt-hashed password. Duplicate email is logged to stderr, no error raised, returns existing id.
- **ORM mirror layer**: User/Source/FeedState/Signal SQLAlchemy 2.0 declarative models exactly match the Plan 01-01 migrations, including the composite `(id, ingested_at)` PK required by TimescaleDB hypertables.
- **Redis client helper**: Lazy `get_redis()` returning aioredis client with `decode_responses=True` — ready for Plan 03's XADD/PUBLISH and Plan 04's XREADGROUP consumer.
- **App factory + lifespan**: `src.main:app` exposes auth router + `/api/healthz`; lifespan closes the Redis connection on shutdown. Route introspection smoke test confirms all four paths are registered.

## Task Commits

1. **Task 1 RED — failing tests for SignalEvent + SourceConnector** — `fd799cb` (test)
2. **Task 1 GREEN — SignalEvent schema + SourceConnector Protocol + ORM models** — `99a453d` (feat)
3. **Task 2 RED — failing tests for passwords + sessions** — `31dc9d9` (test)
4. **Task 2 GREEN — auth modules + endpoints + redis client** — `7ea17cc` (feat)
5. **Task 3 — FastAPI entrypoint + CLI + integration test + README + email-validator** — `ce6e120` (feat)

**Plan metadata commit:** (to be appended — SUMMARY + STATE + ROADMAP + REQUIREMENTS)

## Auth Flow Diagram

```
  Browser                              Caddy :8080                   FastAPI :8000
     |                                      |                              |
     | POST /api/auth/login {email,pw} ---> | ---------------------------> |
     |                                      |                              | 1. SELECT users WHERE email=?
     |                                      |                              | 2. verify_password(pw, hash) (bcrypt)
     |                                      |                              | 3. issue_session_cookie(u.id) (itsdangerous)
     | <-- 200 + Set-Cookie: osint_session ---------------------------------|
     |                                      |                              |
     | GET /api/auth/me (with cookie) ----> | ---------------------------> |
     |                                      |                              | require_user:
     |                                      |                              |   - verify_session_cookie(token) -> uid
     |                                      |                              |   - SELECT users WHERE id=uid -> User
     | <-- 200 {id, email} -----------------|----------------------------- |
     |                                      |                              |
     | POST /api/auth/logout -------------> | ---------------------------> |
     | <-- 204 + Set-Cookie: ""(expired) --|------------------------------ |
```

Cookie travels only over the Caddy origin (`localhost:8080` in dev, the public origin in prod) — the Plan 01-01 reverse proxy decision means browser never speaks to `:8000` directly, eliminating cookie-scope fragility (Pitfall 8).

## SourceConnector Protocol — For Phase 2/3 Adapter Authors

```python
from src.schemas.signal import SignalEvent, Provenance
from src.connectors.base import SourceConnector, SourceHealth
from src.connectors.registry import register


class MySourceConnector:
    source_id = "myprovider:channel-xyz"
    poll_interval_s = 60

    async def fetch(self):
        async for raw_item in self._poll():
            yield SignalEvent(
                id=SignalEvent.make_id(self.source_id, raw_item["guid"]),
                source_item_id=raw_item["guid"],
                timestamp=raw_item["pub_date"],
                title=raw_item.get("title"),
                content=raw_item["body"],
                provenance=Provenance(
                    source_id=self.source_id,
                    source_type="myprovider",
                    source_url=raw_item["link"],
                    fetched_at=...,
                    ingested_at=...,
                ),
                raw=raw_item,
            )

    async def health(self) -> SourceHealth:
        ...


register(MySourceConnector())  # runtime-checked via isinstance(obj, SourceConnector)
```

No ABC subclassing. No base-class import of heavy dependencies. Every adapter is a leaf.

## CLI Usage Example

```bash
# Inside the running backend container:
docker compose exec backend python -m src.cli.create_user --email analyst@local --password changeme
# created user id=1 email=analyst@local

# Running locally (requires DATABASE_URL in env or .env):
cd backend && uv run python -m src.cli.create_user --email analyst@local --password changeme

# Duplicate run is idempotent (stderr warning, no error):
uv run python -m src.cli.create_user --email analyst@local --password changeme
# user already exists: analyst@local (id=1)
```

## Link Patterns Downstream Plans Will Grep

These are the literal import lines downstream plans (03, 04, 05) will rely on:

```python
# Plan 03 (RSS connector / publisher / persister):
from src.schemas.signal import SignalEvent, Provenance
from src.connectors.base import SourceConnector, SourceHealth
from src.connectors.registry import register, all_connectors
from src.models.signal import Signal               # Signal.from_event(ev) maps Pydantic -> ORM
from src.models.feed_state import FeedState        # conditional-GET state
from src.redis_client import get_redis, close_redis

# Plan 04 (API: signals/stream/sources/health):
from src.auth.dependencies import require_user    # cookie-gated endpoints including /api/stream
from src.models.signal import Signal
from src.models.source import Source
from src.redis_client import get_redis

# Plan 05 (frontend — consumed over HTTP only, no Python imports):
#   uses /api/auth/login, /api/auth/me, /api/auth/logout as defined here
```

## Decisions Made

- **email-validator added as explicit dep** — pydantic>=2.9's `EmailStr` does not transitively pull `email-validator`, but uses it at instantiation. Without it, `from src.main import app` fails at import because `LoginRequest` and `UserOut` define `email: EmailStr`. Rule 3 blocking deviation, resolved by adding `email-validator>=2.2,<3`.
- **Runtime-checkable Protocol over ABC** — `isinstance(obj, SourceConnector)` checks shape without forcing adapter authors to import a base class. This was the highest-leverage call-out in RESEARCH.md §Pattern 1.
- **Fixed salt, not per-user salt** — itsdangerous `URLSafeTimedSerializer` salt is a deployment-wide constant (`"osint.session.v1"`). It is NOT a secret (`session_secret` is). Versioning the salt gives a clean global-session-invalidation path if we ever need it.
- **Timing-ish login** — `verify_password` is called even when the user row doesn't exist, to keep the response-time distribution similar across user-found and user-not-found. This is not constant-time, but removes the easy enumeration vector.
- **require_user loads the full User row** (not just uid) — downstream endpoints (Plan 04) can trust `user.email` in logs/audit without an extra query; cost is one trivial SELECT on a primary-key lookup per request.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test_expired_rejected` sleep duration was too short**
- **Found during:** Task 2 GREEN — running `uv run pytest tests/unit/test_sessions.py`
- **Issue:** The plan-provided test slept 1.1s against `max_age_s=1`. But `itsdangerous` stores timestamps at second granularity and checks `age > max_age` strictly (not `>=`). After 1.1s of real time, the integer age can still be 1, which equals `max_age_s=1` and passes verification — test asserted `None` and got `42`.
- **Fix:** Bumped `time.sleep(1.1)` → `time.sleep(2.1)` so the integer age is at least 2 seconds, which strictly exceeds `max_age_s=1`.
- **Files modified:** `backend/tests/unit/test_sessions.py`
- **Commit:** `7ea17cc` (committed together with Task 2 GREEN)

**2. [Rule 3 - Blocking] Missing `email-validator` runtime dependency**
- **Found during:** Task 3 — running the route-introspection smoke test (`uv run python -c "from src.main import app; ..."`)
- **Issue:** `from src.main import app` failed with `ImportError: email-validator is not installed`. `LoginRequest` and `UserOut` use `pydantic.EmailStr`, which requires `email-validator` at schema-construction time; it is not pulled transitively by `pydantic>=2.9`.
- **Fix:** Added `"email-validator>=2.2,<3"` to `[project].dependencies` in `backend/pyproject.toml`, then `uv sync` regenerated `uv.lock`.
- **Files modified:** `backend/pyproject.toml`, `backend/uv.lock`
- **Verification:** `uv run python -c "from src.main import app; ..."` now prints all four expected route paths (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/healthz`).
- **Commit:** `ce6e120` (Task 3)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking).
**Impact on plan:** Zero scope creep. The bug fix is a 1-line sleep adjustment; the blocking fix is a transitive-dependency pin the plan implicitly required.

## Issues Encountered

None beyond the two auto-fixed deviations above. No architectural changes, no user decisions needed, no auth gates — this plan was fully autonomous.

## Known Stubs

None. All created files ship working code with no placeholder values, no "coming soon" copy, no hardcoded empty returns that flow to UI. The only `raise NotImplementedError`-style surface is the Protocol's `fetch`/`health` method signatures, which is by design (the Protocol defines the shape; concrete connectors land in Plan 03+).

## User Setup Required

None. No external accounts, no API keys, no dashboards. The developer runs:

```bash
docker compose up -d db redis
cd backend && uv sync && uv run alembic upgrade head
uv run python -m src.cli.create_user --email me@local --password whatever
uv run uvicorn src.main:app --port 8000
# Then curl -c cookies.txt -X POST http://localhost:8080/api/auth/login ...
```

## Next Phase Readiness

- **Ready for Plan 03 (RSS connector + pipeline):** `SignalEvent`, `Provenance`, `SourceConnector`, `registry.register`, `Signal.from_event`, `FeedState` ORM, `get_redis()` — everything the connector/publisher/persister needs is importable now.
- **Ready for Plan 04 (API endpoints including SSE):** `require_user` dependency is wired; the router-mount pattern in `create_app()` is ready for `signals_router` to be added next to `auth_router`; `/api/healthz` confirms the FastAPI stack is healthy.
- **Ready for Plan 05 (Next.js dashboard):** Auth endpoints are stable — `/api/auth/login` (body: `{email, password}`), `/api/auth/me` (cookie → `{id, email}`), `/api/auth/logout` (clears cookie). Shape matches what the login page will POST and what the auth-hook will poll.
- **No blockers.**

## Self-Check: PASSED

- All 28 claimed created files exist on disk (verified by listing `backend/src`, `backend/tests`).
- All 5 task commits exist in `git log`: `fd799cb`, `99a453d`, `31dc9d9`, `7ea17cc`, `ce6e120`.
- All 13 unit tests pass (`uv run pytest tests/unit -x -q` → `13 passed`).
- Route introspection smoke test confirms `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/healthz` are registered on the app.

---
*Phase: 01-vertical-slice-rss-end-to-end*
*Completed: 2026-04-20*
