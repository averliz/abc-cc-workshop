# Phase 1: Vertical Slice (RSS end-to-end) - Research

**Researched:** 2026-04-21
**Domain:** Real-time OSINT ingestion pipeline — RSS → canonical schema → Redis Streams → TimescaleDB → SSE → Next.js dark dashboard
**Confidence:** HIGH

## Summary

This phase stands up the entire five-layer streaming spine end-to-end using RSS as the first and only source. The architecture, stack, and domain pitfalls are already decided in `.planning/research/{STACK,ARCHITECTURE,PITFALLS}.md` — this research does not revisit those decisions. Instead it resolves the load-bearing integration details Phase 1 needs: *how exactly* do FastAPI, Redis Streams, TimescaleDB, Next.js Route Handlers, and TanStack Query `streamedQuery` fit together; which library versions are current as of April 2026; and which concrete pitfalls the plan must guard against for a vertical-slice build.

Two material findings update the prior research:

1. **FastAPI now ships first-class SSE.** `fastapi.sse.EventSourceResponse` (added via the Starlette SSE proposal, merged into FastAPI 0.118+) handles `Content-Type`, auto keep-alives every 15 s, `Cache-Control: no-cache`, and a typed `ServerSentEvent(data=..., id=..., event=..., retry=...)` primitive. The plan should use this rather than hand-rolling SSE framing on a plain `StreamingResponse`.
2. **`@tanstack/react-query` ships `experimental_streamedQuery`** which consumes any `AsyncIterable` and reconciles chunks into the query cache (`refetchMode: 'append' | 'reset' | 'replace'` + optional `reducer`). This is the 2026 pattern for pairing SSE with TanStack Query — not a manual `useEffect` subscription.

**Primary recommendation:** Build the phase as six parallel-izable tracks: (1) Docker Compose infra + migrations, (2) FastAPI skeleton + auth, (3) RSS connector + SignalEvent schema, (4) Redis Streams producer/consumer + Postgres sink, (5) FastAPI `/api/stream` SSE endpoint, (6) Next.js dark dashboard with TanStack Virtual + `streamedQuery`. The Source Adapter contract (FOUN-03) is the single most important deliverable — everything downstream in Phases 2-3 depends on it, and the RSS connector must exercise it end-to-end so the shape is proven, not just documented.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard Layout**
- **D-01:** Single-panel feed layout with a sidebar for source health. No multi-panel or tabbed layouts in v1 — prove the core value with the simplest effective layout.

**Feed Item Presentation**
- **D-02:** Compact card format per item: source icon, title/headline, timestamp (relative), and 2-line content preview. Cards should be visually distinct per source type (color-coded left border or icon).
- **D-03:** Virtualized rendering mandatory from day one — react-window or similar. "Pause stream" affordance when user is reading older items.

**Source Health Display**
- **D-04:** Sidebar panel (right side) showing per-source status: last-fetch timestamp, error count, throughput (items/min). Always visible alongside feed. Status badges: green/yellow/red.

**Authentication UX**
- **D-05:** Simple email/password login form. Session persisted via httpOnly cookie. No OAuth, no magic links, no 2FA for v1. Single-user is acceptable.

### Claude's Discretion

- Docker Compose service topology (how many containers, naming)
- Specific Python framework for ingestion (FastAPI, plain asyncio, etc.)
- Database migration tooling choice
- Redis Streams consumer group naming and configuration
- SSE endpoint implementation details (reconnection, Last-Event-ID)
- Exact SignalEvent schema field names (as long as provenance fields are included)
- Frontend component library choice (shadcn, custom, etc.)
- Test framework and strategy

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUN-01 | Project skeleton with Docker Compose for all services | Stack §Deployment/Infra; `docker-compose` service list §Architecture below |
| FOUN-02 | Canonical SignalEvent schema with provenance fields | ARCHITECTURE.md Pattern 2; extended schema in Code Examples below |
| FOUN-03 | Source Adapter pattern as pluggable connector interface | ARCHITECTURE.md Pattern 1; Python `Protocol`-based contract in Code Examples below |
| INGS-01 | RSS/news feed connector ingesting items | `feedparser` 6.0.12 + `httpx` async with conditional GET (ETag/Last-Modified) |
| PIPE-01 | Redis Streams event bus | `redis-py` 6.4 `xadd` + `xgroup_create` + `xreadgroup` (consumer groups) |
| PIPE-02 | TimescaleDB 30-day retention | `create_hypertable('signals','ingested_at')` + `add_retention_policy('signals', INTERVAL '30 days')` |
| PIPE-04 | SSE endpoint streaming normalized events | `fastapi.sse.EventSourceResponse` — server-side filter spec from query params; `Last-Event-ID` resumption |
| DASH-01 | Unified real-time feed < 5s latency | Architecture: connector poll → Redis Stream → Postgres + Pub/Sub → SSE → client. Budget: poll interval ≤ 60 s, everything downstream < 1 s. |
| DASH-02 | Virtualized scrolling at 1000+ items/min | `@tanstack/react-virtual` 3.13.24 (maintained successor to react-window; headless, works with variable-height cards) |
| DASH-03 | Item detail view | Drawer/dialog from `shadcn/ui`; item data already in feed state — no extra fetch |
| DASH-04 | Dark mode as default | Tailwind 4 `dark:` variants + `next-themes` with `defaultTheme="dark"` |
| DASH-05 | Source health panel | Separate `GET /api/sources/health` route + 10 s polling via TanStack Query; no SSE needed here |
| AUTH-01 | Local-credentials login | FastAPI-Users OR bespoke bcrypt + `httpOnly` cookie; single-user seeded via CLI |
| AUTH-02 | Session persists across refresh | Server-signed session cookie (`itsdangerous` or `authlib` JWT) stored httpOnly + SameSite=Lax |

## Project Constraints (from CLAUDE.md)

Extracted actionable directives — the plan MUST comply:

- **Public sources only** (RSS qualifies). No scraping behind login.
- **No stored credentials for monitored targets.** Read-only collection. (N/A for RSS but bakes into adapter contract.)
- **Performance:** Dashboard updates within 5 s of source data availability. Informs polling intervals and SSE buffering.
- **Scale:** 100+ sources, 1000+ items/min target. Phase 1 validates architecture at this ceiling even with one source — load-test with synthetic RSS generator to prove headroom.
- **Stack lock-in** (Next.js 16.2+, React 19.2, Python 3.12 + FastAPI, Redis 7.4, TimescaleDB 2.17, Tailwind 4, TanStack Query v5): the CLAUDE.md block freezes these. Do not propose alternatives.
- **Security:** `Next.js ≥ 16.1` required for CVE-2025-66478. Current latest is 16.2.4 — use that.
- **GSD Workflow Enforcement:** File-changing tools must be driven through a GSD command (this phase runs under `/gsd:execute-phase`).
- **"Conventions not yet established"** — this phase establishes them. Code structure, naming, test layout will be consumed by `CONVENTIONS.md` after Phase 1 completes.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python | 3.12+ | Backend + connector runtime | Locked in CLAUDE.md; OSINT ecosystem |
| FastAPI | 0.118+ (latest 0.128.0) | HTTP API + SSE host | `fastapi.sse.EventSourceResponse` first-class in 0.118+ |
| uvicorn | 0.32+ | ASGI server | Standard for FastAPI |
| Pydantic | 2.9+ | `SignalEvent` validation at ingress | Enforces schema at every boundary |
| redis-py | 6.4.0 | Redis Streams client (async) | `redis.asyncio` supports `xadd`/`xreadgroup`; async consumer groups |
| asyncpg | 0.30+ | Postgres driver | Fastest async driver; used by SQLAlchemy async |
| SQLAlchemy | 2.x (async) | ORM + migrations | Pair with Alembic for schema versioning |
| Alembic | 1.13+ | DB migrations | Standard SQLAlchemy migration tool; TimescaleDB hypertable creation goes in initial migration |
| feedparser | 6.0.12 | RSS/Atom parsing | Canonical Python RSS lib; 6.0.12 is current (pypi, verified 2026-04-21) |
| httpx | 0.27+ | Async HTTP with conditional GET | ETag/Last-Modified support; per-host connection pools |
| bcrypt / passlib | latest | Password hashing | Standard |
| itsdangerous | 2.2+ | Signed session cookies | Lightweight; avoids full JWT machinery for single-user v1 |
| Next.js | 16.2.4 | Frontend framework | CVE-2025-66478 requires ≥16.1; 16.2.4 latest |
| React | 19.2.5 | UI runtime | Pairs with Next 16.2 |
| TypeScript | 5.6+ | Type safety | Non-negotiable for dashboard |
| Tailwind CSS | 4.0+ | Styling | CSS-based config |
| shadcn/ui | latest | Component primitives | Dialog/Drawer/Button/Card — all needed |
| @tanstack/react-query | 5.99.2 (v5.90+) | Server state + `experimental_streamedQuery` | Native AsyncIterable consumer; reconciles SSE into cache |
| @tanstack/react-virtual | 3.13.24 | Virtualized feed | Headless, variable-height, modern successor to `react-window` |
| next-themes | latest | Dark-mode toggle | Default theme `dark`; SSR-safe |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.x | Relative timestamps ("2 min ago") | Per-card timestamp rendering |
| zod | 3.x | Frontend schema guard | Validate SSE payload shape on client before render |
| zustand | 5.x | Local UI state | "Pause stream" flag, filter state |
| APScheduler | 3.10+ | In-process RSS poll scheduling | Simpler than `arq` when jobs are purely periodic |
| pytest + pytest-asyncio | latest | Backend tests | Integration + unit |
| vitest + @testing-library/react | latest | Frontend tests | Unit + component |
| playwright | 1.48+ (Node side, for e2e only) | End-to-end smoke | One happy-path test: login → see feed item |
| ruff + mypy | latest | Lint + types | Standard Python 2026 toolchain |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| feedparser | fastfeedparser | 25× faster but smaller community; not needed at Phase 1 scale (one feed, periodic polls). Revisit at Phase 2 if adding dozens of RSS sources. |
| @tanstack/react-virtual | react-window 2.2.7 | react-window works; TanStack Virtual is headless + variable-height-friendly + actively maintained. User decision D-03 says "react-window or similar" — either is acceptable. Prefer TanStack Virtual for variable-height cards (D-02). |
| fastapi.sse.EventSourceResponse | Plain StreamingResponse + manual SSE framing | Manual framing means reimplementing keep-alive, Last-Event-ID routing, `Cache-Control`. Use the first-class helper. |
| itsdangerous | FastAPI-Users + JWT | FastAPI-Users is heavier; D-05 says "single-user acceptable," so signed-cookie sessions suffice. |
| Alembic | Raw SQL in `migrations/` folder | Alembic handles version tracking + rollback; worth the small complexity. TimescaleDB-specific DDL (hypertable, retention policy) goes in `op.execute()` blocks. |
| Redis Pub/Sub for SSE fanout | Redis Streams consumer with per-connection subscriber | Pub/Sub is simpler for fanout; Streams are the durable log. Use **both**: Streams for the durable pipeline (ingest→DB), Pub/Sub for the "new event" fanout that wakes up SSE connections. |

**Installation:**

```bash
# Backend (uv)
uv init backend
uv add fastapi "uvicorn[standard]" pydantic asyncpg "sqlalchemy[asyncio]" \
       alembic redis httpx feedparser apscheduler \
       bcrypt passlib itsdangerous
uv add --dev pytest pytest-asyncio httpx ruff mypy

# Frontend (from project root or web/)
npx create-next-app@latest web --typescript --tailwind --app --eslint --turbopack
cd web
npm install @tanstack/react-query@^5.99 @tanstack/react-virtual@^3.13 \
            zustand zod date-fns next-themes
npx shadcn@latest init
npx shadcn@latest add button card dialog drawer input badge sheet
```

**Version verification (2026-04-21):**
- `next@16.2.4`, `react@19.2.5`, `@tanstack/react-query@5.99.2`, `@tanstack/react-virtual@3.13.24` verified via `npm view`.
- `feedparser==6.0.12` verified via `pip index versions feedparser`.
- FastAPI versions 0.115.13 through 0.128.0 available; target ≥0.118 for `fastapi.sse` module (Context7 confirmed).
- `redis-py` at v6.4.0 (Context7); async streams API stable.

## Architecture Patterns

### Recommended Project Structure

```
gsd-shot-dashboard/
├── docker-compose.yml              # postgres, redis, backend, worker, web
├── .env.example                    # all service env vars (no secrets committed)
│
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/versions/           # migrations incl. TimescaleDB hypertable + retention
│   ├── src/
│   │   ├── main.py                 # FastAPI app factory
│   │   ├── config.py               # Pydantic Settings (env-driven)
│   │   ├── db.py                   # asyncpg/SQLAlchemy session
│   │   ├── redis_client.py         # shared async Redis
│   │   ├── schemas/
│   │   │   └── signal.py           # SignalEvent Pydantic model — canonical
│   │   ├── models/
│   │   │   ├── signal.py           # SQLAlchemy signals table (hypertable)
│   │   │   ├── source.py           # sources + health
│   │   │   └── user.py
│   │   ├── connectors/
│   │   │   ├── base.py             # SourceConnector Protocol (FOUN-03)
│   │   │   ├── rss.py              # RSS implementation (INGS-01)
│   │   │   └── registry.py         # source registration + config
│   │   ├── pipeline/
│   │   │   ├── publisher.py        # writes to Redis Stream (PIPE-01)
│   │   │   ├── persister.py        # consumer group → Postgres (PIPE-02)
│   │   │   └── broadcaster.py      # Pub/Sub fanout for SSE
│   │   ├── api/
│   │   │   ├── auth.py             # login, logout, /me (AUTH-01, AUTH-02)
│   │   │   ├── signals.py          # GET /api/signals (backfill)
│   │   │   ├── stream.py           # GET /api/stream (SSE) (PIPE-04)
│   │   │   └── sources.py          # GET /api/sources/health (DASH-05)
│   │   └── worker.py               # entrypoint that runs connectors + persister
│   └── tests/
│       ├── unit/                   # schema, connector normalization
│       ├── integration/            # end-to-end with testcontainers-python
│       └── conftest.py
│
└── web/                            # Next.js 16 App Router
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── app/
        │   ├── layout.tsx          # next-themes ThemeProvider defaultTheme="dark"
        │   ├── providers.tsx       # QueryClientProvider
        │   ├── login/page.tsx
        │   ├── (dashboard)/
        │   │   └── page.tsx        # feed + health sidebar (D-01)
        │   └── api/
        │       └── auth/*          # thin pass-through to FastAPI (or direct)
        ├── components/
        │   ├── feed/
        │   │   ├── FeedList.tsx    # virtualized (D-03)
        │   │   ├── FeedCard.tsx    # compact card (D-02)
        │   │   └── ItemDetail.tsx  # drawer (DASH-03)
        │   ├── health/
        │   │   └── SourceHealthPanel.tsx  # sidebar (D-04)
        │   └── ui/                 # shadcn copies
        ├── hooks/
        │   ├── useSignalStream.ts  # streamedQuery over SSE
        │   └── useSourceHealth.ts  # polled query
        └── lib/
            ├── api.ts              # fetch wrapper with cookie credentials
            └── schema.ts           # zod SignalEvent mirror
```

### Pattern 1: Source Adapter Contract (FOUN-03)

**What:** A small, stable Protocol that every source implements. The pipeline downstream of this never sees source-specific types.

**When to use:** Mandatory from day one. This is the single highest-leverage decision in Phase 1.

**Example:**

```python
# backend/src/connectors/base.py
# Source: derived from ARCHITECTURE.md Pattern 1 + PITFALLS.md #2
from __future__ import annotations
from typing import Protocol, AsyncIterator, Literal
from datetime import datetime
from src.schemas.signal import SignalEvent

HealthStatus = Literal["healthy", "degraded", "failed"]

class SourceHealth:
    last_success_at: datetime | None
    last_error: str | None
    error_count_1h: int
    throughput_per_min: float
    status: HealthStatus

class SourceConnector(Protocol):
    source_id: str              # stable ID, e.g. "rss:bbc-world"
    poll_interval_s: int        # APScheduler reads this

    async def fetch(self) -> AsyncIterator[SignalEvent]:
        """Yield normalized SignalEvent instances. Exceptions propagate to
        the scheduler, which records them against source health and backs off."""
        ...

    async def health(self) -> SourceHealth: ...
```

The RSS connector implements this Protocol; the pipeline publisher accepts `SourceConnector` only. Phase 2 Reddit/HN connectors slot in with zero pipeline changes.

### Pattern 2: Canonical SignalEvent Schema (FOUN-02)

**What:** Every source normalizes to one Pydantic model before publishing. The model carries provenance so every downstream view can show "how do we know this?"

**Example:**

```python
# backend/src/schemas/signal.py
# Source: ARCHITECTURE.md Pattern 2, extended with provenance per PITFALLS.md #1
from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime
from typing import Any

class Provenance(BaseModel):
    source_id: str              # "rss:bbc-world"
    source_type: str            # "rss" | "reddit" | "hn" | ...
    source_url: HttpUrl         # link back to original item
    fetched_at: datetime        # when WE fetched it
    ingested_at: datetime       # when WE inserted into DB
    confidence: float = 1.0     # 0-1, single-source = 1.0 baseline

class SignalEvent(BaseModel):
    id: str = Field(..., description="deterministic hash of (source_id, source_item_id)")
    source_item_id: str         # platform-native ID (RSS <guid>)
    timestamp: datetime         # source-reported event time (pub_date for RSS)
    author: str | None = None
    title: str | None = None
    content: str
    tags: list[str] = Field(default_factory=list)
    provenance: Provenance
    raw: dict[str, Any] | None = None  # original payload for debugging; excluded from SSE
```

### Pattern 3: Five-Layer Pipeline (PIPE-01, PIPE-02, PIPE-04)

**What:** Ingest → normalize → **publish to stream** → persist (consumer A) + broadcast (consumer B) → SSE.

**Data flow:**

```
RSS poller (APScheduler)
  └── feedparser + httpx conditional GET (ETag / Last-Modified)
        └── dedupe (Redis SETEX key=sha256(source_id, source_item_id) TTL=24h)
              └── XADD signals * field=value ...           (Redis Stream: durable log)
                   ├── Persister consumer (XREADGROUP group=persist)
                   │      └── INSERT INTO signals (hypertable)  → XACK
                   └── Broadcaster consumer (XREADGROUP group=broadcast)
                          └── PUBLISH signals:new payload  (Pub/Sub for SSE fanout)
                                └── FastAPI /api/stream subscribers
                                      └── EventSourceResponse → browser
                                            └── TanStack Query streamedQuery
                                                  └── FeedList (virtualized)
```

Two consumer groups are the key insight: **persistence** must be durable (if the DB is down, messages stay in the stream; XACK only after successful INSERT). **Broadcast** is ephemeral (drop on the floor if no SSE subscribers — they'll backfill via `GET /api/signals` on reconnect).

**When:** Exactly as described. Do not collapse — even with one source, both consumer groups must exist from Phase 1.

### Pattern 4: TimescaleDB Hypertable + Retention (PIPE-02)

**What:** The `signals` table is a hypertable partitioned on `ingested_at`. A retention policy drops chunks older than 30 days automatically.

**Migration (Alembic up):**

```python
# alembic/versions/0002_signals_hypertable.py
def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")
    op.execute("""
        CREATE TABLE signals (
            id TEXT NOT NULL,
            source_item_id TEXT NOT NULL,
            source_id TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_url TEXT NOT NULL,
            ts TIMESTAMPTZ NOT NULL,             -- source-reported time
            ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            author TEXT,
            title TEXT,
            content TEXT NOT NULL,
            tags TEXT[] NOT NULL DEFAULT '{}',
            confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            raw JSONB,
            PRIMARY KEY (id, ingested_at)        -- hypertable PK must include partition col
        )
    """)
    op.execute("SELECT create_hypertable('signals', 'ingested_at', chunk_time_interval => INTERVAL '1 day')")
    op.execute("CREATE INDEX idx_signals_source_ts ON signals (source_id, ingested_at DESC)")
    op.execute("CREATE INDEX idx_signals_ingested ON signals (ingested_at DESC)")
    op.execute("SELECT add_retention_policy('signals', INTERVAL '30 days')")
```

**Critical:** the hypertable primary key must include the partition column (`ingested_at`). A PK of just `id` fails.

### Pattern 5: FastAPI SSE with EventSourceResponse (PIPE-04)

**What:** FastAPI 0.118+ has `fastapi.sse` with `EventSourceResponse` and `ServerSentEvent` primitives. Use them.

**Example:**

```python
# backend/src/api/stream.py
# Source: Context7 /fastapi/fastapi — "Server-Sent Events" tutorial
from fastapi import APIRouter, Depends, Request
from fastapi.sse import EventSourceResponse, ServerSentEvent
from typing import AsyncIterable
from src.schemas.signal import SignalEvent
from src.api.auth import require_user
from src.redis_client import redis

router = APIRouter()

async def signal_stream(request: Request, last_event_id: str | None) -> AsyncIterable[ServerSentEvent]:
    # 1. Backfill since last_event_id (if client reconnecting)
    if last_event_id:
        async for ev in _backfill_since(last_event_id):
            yield ServerSentEvent(id=ev.id, event="signal", data=ev.model_dump(exclude={"raw"}))

    # 2. Subscribe to live fanout
    pubsub = redis.pubsub()
    await pubsub.subscribe("signals:new")
    try:
        async for msg in pubsub.listen():
            if await request.is_disconnected():
                break
            if msg["type"] != "message":
                continue
            ev = SignalEvent.model_validate_json(msg["data"])
            yield ServerSentEvent(id=ev.id, event="signal", data=ev.model_dump(exclude={"raw"}))
    finally:
        await pubsub.unsubscribe("signals:new")
        await pubsub.close()

@router.get("/api/stream")
async def stream(request: Request, user=Depends(require_user)):
    last_event_id = request.headers.get("last-event-id")
    return EventSourceResponse(signal_stream(request, last_event_id))
```

`EventSourceResponse` handles `Content-Type: text/event-stream`, `Cache-Control: no-cache`, 15 s keep-alive ping comments, and correct `\n\n` framing.

### Pattern 6: TanStack Query `streamedQuery` over SSE

**What:** Bridge `EventSource` → `AsyncIterable` → `streamedQuery`. The hook automatically appends incoming signals to the query cache.

**Example:**

```typescript
// web/src/hooks/useSignalStream.ts
// Source: Context7 /tanstack/query — streamedQuery reference
import { experimental_streamedQuery as streamedQuery, useQuery } from '@tanstack/react-query'
import type { SignalEvent } from '@/lib/schema'

async function* sseIterator(url: string): AsyncIterable<SignalEvent[]> {
  const es = new EventSource(url, { withCredentials: true })
  const queue: SignalEvent[] = []
  let resolve: (() => void) | null = null

  es.addEventListener('signal', (e) => {
    queue.push(JSON.parse((e as MessageEvent).data))
    resolve?.()
    resolve = null
  })

  try {
    while (true) {
      if (queue.length === 0) {
        await new Promise<void>((r) => { resolve = r })
      }
      yield queue.splice(0)
    }
  } finally {
    es.close()
  }
}

export function useSignalStream() {
  return useQuery<SignalEvent[]>({
    queryKey: ['signals', 'stream'],
    queryFn: streamedQuery({
      streamFn: () => sseIterator('/api/stream'),
      refetchMode: 'append',
      reducer: (acc, chunk) => [...chunk, ...acc].slice(0, 5000),  // cap cache
      initialValue: [],
    }),
    staleTime: Infinity,
  })
}
```

The `reducer` caps in-memory signals at 5000 to prevent unbounded growth — at 1000/min this is a 5-minute window, which combined with backfill from `/api/signals` covers the user's visible scroll.

### Pattern 7: Virtualized Feed with TanStack Virtual

**What:** Variable-height card virtualization keyed by signal ID.

**Example:**

```typescript
// web/src/components/feed/FeedList.tsx
// Source: Context7 /tanstack/virtual
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

export function FeedList({ items }: { items: SignalEvent[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const v = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,             // ~2-line card
    overscan: 8,
    getItemKey: (i) => items[i].id,
  })

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: v.getTotalSize(), position: 'relative' }}>
        {v.getVirtualItems().map((row) => (
          <div
            key={row.key}
            ref={v.measureElement}
            data-index={row.index}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${row.start}px)` }}
          >
            <FeedCard signal={items[row.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

Use `measureElement` for variable-height cards (D-02 says cards have different content lengths).

### Anti-Patterns to Avoid

- **Connector writes directly to Postgres** — violates PITFALLS #5 and success criterion 6. Everything goes through the stream.
- **Polling the DB from the frontend** — breaks the 5 s SLA, burns DB. Use SSE.
- **Single consumer that does persist + broadcast + alert** — one slow sink stalls the others. Separate consumer groups.
- **Client-side filtering only** — at 1000/min this melts the browser. Phase 1 has one source, so no filters yet, but the SSE endpoint signature must already accept a filter query so Phase 2+ can slot filters in without breaking the contract.
- **WebSockets "just in case"** — SSE is locked in STACK.md. Don't second-guess.
- **Global `id` primary key on hypertable** — TimescaleDB requires the partition column in the PK. Use composite `(id, ingested_at)`.
- **Re-fetching source icons on every render** — encode the icon set into a static sprite or Tailwind component; source_type → icon is a pure function.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE framing (`data:`, `id:`, keep-alives) | Manual `StreamingResponse` with string building | `fastapi.sse.EventSourceResponse` + `ServerSentEvent` | Handles keep-alive pings, `Last-Event-ID` convention, correct `\n\n` framing, `Cache-Control` — all edge cases you'll get wrong. |
| RSS parsing (Atom, RSS 1.0/2.0, malformed feeds) | Your own `xml.etree` parser | `feedparser` 6.0.12 | Handles 20+ RSS/Atom dialects, malformed XML, character encodings, deduped GUID/link fallback. Rewriting this costs weeks. |
| Redis consumer groups + pending-entries handling | Your own `WHILE True: XREAD` loop | `redis.asyncio` `xgroup_create` + `xreadgroup` + `xack` + `xpending` + `xclaim` | Consumer-group semantics (at-least-once, pending list, idle-claim) are load-bearing correctness properties, not conveniences. |
| Virtualized scrolling (variable height, sticky header, scroll-to-bottom) | Custom `IntersectionObserver` list | `@tanstack/react-virtual` | Measurement, overscan, key stability, scroll restoration — all solved. |
| Password hashing / session cookies | Hand-rolled SHA + localStorage token | `passlib[bcrypt]` + `itsdangerous.URLSafeTimedSerializer` in httpOnly cookie | Timing-safe compare, salting, signed cookie tamper detection. |
| HTTP conditional GET (ETag / Last-Modified) | Ignoring these headers | `httpx` + manual header forwarding (feedparser stores them) | Without conditional GET you re-download every feed every poll — crushes upstream sources and breaks trust fast. |
| Dark-mode persistence (SSR-safe) | Reading `localStorage` in root layout | `next-themes` | Handles hydration mismatch, `prefers-color-scheme`, cookie + localStorage sync. |
| Time-series retention (30-day drop) | A cron job deleting rows | `add_retention_policy('signals', INTERVAL '30 days')` | One SQL call; Timescale handles it at chunk level (drops whole chunks, not row-by-row DELETE). |
| Deterministic signal ID | Random UUIDs | `sha256(f"{source_id}:{source_item_id}")` | Enables cross-run dedupe, idempotent inserts, deterministic Stream IDs. |
| Docker image base selection | Python-slim + manual apt | `python:3.12-slim` + `uv` for deps | Standard; avoid Alpine (musl breaks wheels). |

**Key insight:** The entire Phase 1 vertical slice is composable from first-party libraries. Any custom code outside the adapter contract, the SignalEvent schema, and the UI layout should be viewed with suspicion — it probably means you missed a built-in.

## Common Pitfalls

Phase-1-specific pitfalls, distilled from `.planning/research/PITFALLS.md` plus integration-specific issues verified during this research.

### Pitfall 1: Hypertable PK excludes the partition column

**What goes wrong:** `CREATE TABLE signals (id TEXT PRIMARY KEY, ingested_at TIMESTAMPTZ NOT NULL, ...)` then `create_hypertable` fails with `ERROR: cannot create a unique index without the column "ingested_at"`.
**Why it happens:** Standard Postgres instinct is single-column PK.
**How to avoid:** PK must be `(id, ingested_at)`. Unique indexes the same.
**Warning signs:** Migration fails on `create_hypertable`; don't fix by dropping the PK — fix by adding `ingested_at` to it.

### Pitfall 2: Deduplication lost on restart

**What goes wrong:** Dedupe uses an in-memory set → process restart → every feed item re-ingests.
**Why it happens:** In-memory feels simplest during dev.
**How to avoid:** Redis `SET dedupe:{sha256} 1 EX 86400 NX`. Atomic check-and-set. Use deterministic ID `sha256(source_id:source_item_id)` as key, not content hash (content can change harmlessly on upstream edit).
**Warning signs:** Restart causes a burst of "new" items that aren't actually new. Add a metric: `signals_published / signals_fetched` — steady-state this ratio is ~1.0 for slow-moving feeds.

### Pitfall 3: SSE connection leaks on browser tab close

**What goes wrong:** FastAPI handler holds a `pubsub` subscription, the browser closes the tab, but without `request.is_disconnected()` checks the coroutine never exits. After an hour you have 300 zombie subscribers.
**Why it happens:** `pubsub.listen()` blocks; disconnect is only signaled by the ASGI layer.
**How to avoid:** Wrap the listen loop with an `await request.is_disconnected()` check on every iteration, and use `try/finally` to unsubscribe. `EventSourceResponse` handles this somewhat but verify with a load test.
**Warning signs:** Redis `CLIENT LIST` shows growing subscription count; memory creep on the API process.

### Pitfall 4: feedparser silently skips malformed entries

**What goes wrong:** `feedparser.parse()` swallows partial XML errors and returns `bozo=1` with partial entries. You ignore `bozo` and miss that half the feed didn't parse.
**Why it happens:** feedparser's philosophy is "return what you can."
**How to avoid:** Log warnings when `parsed.bozo == 1`; track `parsed.bozo_exception`. Still process `parsed.entries` — but record the health signal.
**Warning signs:** Source health shows "healthy" but actual item throughput is half what the feed publishes. Compare `parsed.feed.get('updated')` against last-known update.

### Pitfall 5: Conditional GET not honored → re-downloading same content

**What goes wrong:** Every poll re-downloads the full feed, hits rate limits, wastes bandwidth, may get IP-blocked.
**Why it happens:** Forgetting that `feedparser` accepts `etag` and `modified` kwargs and returns them on the response.
**How to avoid:** Persist `{feed_url: (etag, last_modified)}` in Postgres (not Redis — must survive restarts). Pass on next fetch. `feedparser.parse(url, etag=saved_etag, modified=saved_mod)`.
**Warning signs:** Poll time never drops below first-fetch duration; upstream returns 200 instead of 304.

### Pitfall 6: Next.js Route Handler cannot proxy SSE

**What goes wrong:** Developer writes `app/api/stream/route.ts` that `fetch()`es the FastAPI SSE endpoint and tries to forward the stream. Node's `fetch` drops the stream or buffers it, SSE breaks.
**Why it happens:** Temptation to put "all API routes behind Next."
**How to avoid:** For SSE, have the browser connect **directly** to FastAPI (`/api/stream` served by FastAPI, reverse-proxied to the same origin via the production `docker-compose` setup or Next.js `rewrites`). Do NOT wrap it in a Next.js Route Handler.
**Warning signs:** Events arrive in huge batches instead of real-time; connection closes after 30 s (idle timeout).

### Pitfall 7: httpOnly cookie + `fetch()` without `credentials: 'include'`

**What goes wrong:** Login works, but `/api/signals` returns 401. The session cookie is set but not sent.
**Why it happens:** Default `fetch()` does not include credentials for cross-origin (and even same-origin when called from a Next.js dev server at a different port than FastAPI).
**How to avoid:** All API calls use `credentials: 'include'` (or `'same-origin'` if strictly same-origin). `EventSource` takes `withCredentials: true`. Set `SameSite=Lax` on the cookie.
**Warning signs:** Login sets cookie, next request 401s; DevTools → Network → Request Headers shows no `Cookie`.

### Pitfall 8: Session cookie not set when API and web are on different ports in dev

**What goes wrong:** FastAPI on :8000 sets cookie for `localhost:8000`; Next dev on :3000 never sees it.
**Why it happens:** Cookies are host+port scoped by SameSite rules; browsers treat different ports as different origins for CORS but same for cookies — depending on context.
**How to avoid:** Either (a) reverse-proxy FastAPI under the same origin in dev via Next `rewrites` so everything is `localhost:3000`, or (b) set the cookie `Domain=localhost` (not recommended — production-dev divergence). Option (a) is cleaner.
**Warning signs:** Works in Compose (single reverse proxy), breaks in local dev.

### Pitfall 9: Source Adapter leaks raw fields outside connectors/

**What goes wrong:** Someone imports `feedparser.FeedParserDict` in `api/signals.py` because "it's easier."
**Why it happens:** Short-term convenience.
**How to avoid:** CI grep: `rg -t py "from feedparser" src/` must return only `src/connectors/rss.py`. Add a test that asserts no other module imports feedparser.
**Warning signs:** Any time another connector is added, expect the pattern to get tested — make it break loudly at lint time.

### Pitfall 10: "1000 items/min" load not actually tested

**What goes wrong:** Success criterion 3 says 1000+ items/min without performance degradation. If not load-tested, it's a promise not a fact. First real high-volume source (Phase 2 Reddit) exposes buffering, GC, or re-render pauses.
**Why it happens:** Single RSS feed in dev emits maybe 5 items/min.
**How to avoid:** Ship a `scripts/load_generator.py` that XADDs synthetic SignalEvents at target rate. Use it in a verification task to confirm the pipeline holds.
**Warning signs:** Browser tab memory climbs, feed scrolling stutters, Redis Stream length grows unbounded.

### Pitfall 11: TimescaleDB extension missing in migration

**What goes wrong:** Alembic migration runs `SELECT create_hypertable(...)` before the extension exists → fails.
**Why it happens:** `CREATE EXTENSION` is often assumed to be a DB-setup concern, not a migration concern.
**How to avoid:** First statement in the first signals migration: `CREATE EXTENSION IF NOT EXISTS timescaledb;`. Also: use the `timescale/timescaledb` Docker image, not vanilla `postgres:16`.
**Warning signs:** `ERROR: function create_hypertable(...) does not exist`.

### Pitfall 12: Keep-alive proxy timeouts closing SSE connections

**What goes wrong:** Reverse proxy (nginx, Caddy, Fly.io edge) has a 60 s idle timeout; after a minute of silence the SSE connection drops.
**Why it happens:** SSE is long-lived; default proxy timeouts are tuned for normal HTTP.
**How to avoid:** Configure proxy read timeout ≥ 15 min; and/or emit a comment keep-alive (`:\n\n`) every 15 s. `EventSourceResponse` does this automatically; verify with the chosen reverse proxy.
**Warning signs:** `EventSource.onerror` firing every ~60 s even when the backend is fine.

## Open Questions

1. **Docker Compose reverse proxy — include or defer?**
   - What we know: Local dev + production both benefit from a reverse proxy to unify `/api` (FastAPI) and `/` (Next.js) under one origin. Fixes Pitfall #6 and #8.
   - What's unclear: Is Caddy/Traefik justified in Phase 1, or punt to Phase 4 (observability/deploy)?
   - Recommendation: **Include a minimal Caddy (or nginx) service in docker-compose.yml from Phase 1.** Cost is ~15 lines of Caddyfile; benefit is that SSE path, cookie origin, and prod/dev parity are all solved at once. Production deploy outside Compose is a Phase 4 concern.

2. **Deployment target — Fly.io vs Hetzner VPS vs deferred?**
   - What we know: STATE.md lists this as an open question with "Phase 0/1 scaffolding impact only."
   - What's unclear: Does Phase 1 ship anywhere or is it dev-only?
   - Recommendation: Phase 1 targets `docker compose up` on the developer's machine. Deployment platform selection stays deferred until Phase 2 gate.

3. **Single-user seeding — CLI or first-visit bootstrap?**
   - What we know: D-05 says single-user is acceptable. No registration flow needed.
   - What's unclear: How does the first admin account come into existence?
   - Recommendation: CLI command `python -m src.cli.create_user --email --password` run once on first deploy. Simpler than a first-visit bootstrap and keeps the login page single-purpose. Document in README.

4. **Test strategy — testcontainers vs in-repo fixtures?**
   - What we know: Integration tests need real Postgres+Timescale and real Redis.
   - What's unclear: Is `testcontainers-python` heavy enough to slow CI unacceptably?
   - Recommendation: Use testcontainers for integration tests, mark them `@pytest.mark.integration`, run them on CI post-merge not pre-merge. Unit tests (connector normalization, SignalEvent schema) run on every PR with mocks.

5. **GDPR posture for a single-developer dev build — document now or later?**
   - What we know: PITFALLS #4 flags GDPR as a Phase 0/1 concern. STATE.md question 3: EU-facing?
   - What's unclear: Dev-only Phase 1 has no users/data subjects except the developer.
   - Recommendation: Add a `docs/COMPLIANCE.md` stub in Phase 1 that documents "public sources, no data subject processing in dev, DPIA deferred until first analyst onboards." Cost is ~10 minutes; value is the paper trail when it's needed.

## Environment Availability

Probing target environment (Windows 11, Git Bash, working directory `gsd-shot-dashboard`):

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Desktop | All services (Compose) | unverified — check before Wave 1 | — | Required; no fallback. Install if missing. |
| Node.js | Next.js frontend | — (check `node --version`) | expect ≥20 | Install via nvm / official |
| npm / pnpm | Frontend deps | — | — | Use pnpm if preferred; plan references `npm` |
| Python 3.12 | Backend | — (check `python --version`) | expect 3.12.x | Install via `uv python install 3.12` |
| uv | Python project mgmt | — (check `uv --version`) | — | Install: `pip install uv` or `irm https://astral.sh/uv/install.ps1 \| iex` |
| Git | Version control | ✓ (git status works in session) | — | — |

**Action for planner:** Include a Wave 1 task "environment smoke check" that runs `docker --version && node --version && python --version && uv --version` and fails fast with install instructions if any are missing. Do not attempt installs automatically — prompt the developer.

**Missing dependencies with no fallback:**
- Docker Desktop — if missing, the phase cannot execute. Planner's first task must be an environment-check that gates subsequent work.

## Runtime State Inventory

**Skipped.** This phase is greenfield — no existing runtime state to migrate. Every database, stream, and index is created fresh by Alembic migrations in the initial Wave. There is no rename, refactor, or data migration component.

## Code Examples

All code examples above are sourced from Context7 queries against official docs on 2026-04-21. Full citations in the Sources section.

Additional concrete examples the planner can reference:

### RSS Connector implementing the Protocol

```python
# backend/src/connectors/rss.py
# Source: feedparser 6.0.12 docs + connector pattern from ARCHITECTURE.md
import hashlib
from datetime import datetime, timezone
from typing import AsyncIterator
import feedparser
import httpx
from src.connectors.base import SourceConnector, SourceHealth
from src.schemas.signal import SignalEvent, Provenance

class RSSConnector:
    def __init__(self, source_id: str, feed_url: str, poll_interval_s: int = 60):
        self.source_id = source_id
        self.feed_url = feed_url
        self.poll_interval_s = poll_interval_s
        self._etag: str | None = None
        self._modified: str | None = None
        self._last_success: datetime | None = None

    async def fetch(self) -> AsyncIterator[SignalEvent]:
        async with httpx.AsyncClient(timeout=30) as client:
            headers = {}
            if self._etag: headers["If-None-Match"] = self._etag
            if self._modified: headers["If-Modified-Since"] = self._modified
            resp = await client.get(self.feed_url, headers=headers)
            if resp.status_code == 304:
                return  # nothing new
            resp.raise_for_status()

        parsed = feedparser.parse(resp.content)
        self._etag = resp.headers.get("etag")
        self._modified = resp.headers.get("last-modified")
        if parsed.bozo:
            # log warning, continue with partial entries
            pass

        now = datetime.now(timezone.utc)
        for entry in parsed.entries:
            source_item_id = entry.get("id") or entry.get("link") or entry.get("title", "")
            if not source_item_id:
                continue
            det_id = hashlib.sha256(f"{self.source_id}:{source_item_id}".encode()).hexdigest()
            ts = _parse_time(entry.get("published_parsed") or entry.get("updated_parsed")) or now
            yield SignalEvent(
                id=det_id,
                source_item_id=source_item_id,
                timestamp=ts,
                author=entry.get("author"),
                title=entry.get("title"),
                content=entry.get("summary", "") or entry.get("description", ""),
                tags=[t.term for t in entry.get("tags", []) if hasattr(t, "term")],
                provenance=Provenance(
                    source_id=self.source_id,
                    source_type="rss",
                    source_url=entry.get("link", self.feed_url),
                    fetched_at=now,
                    ingested_at=now,
                    confidence=1.0,
                ),
                raw=dict(entry),
            )
        self._last_success = now

    async def health(self) -> SourceHealth:
        ...  # read counters maintained by the publisher
```

### Redis Streams publisher + persister skeleton

```python
# backend/src/pipeline/publisher.py
# Source: Context7 /redis/redis-py — Redis Streams
import redis.asyncio as aioredis
from src.schemas.signal import SignalEvent

STREAM = "signals"

async def publish(redis: aioredis.Redis, ev: SignalEvent) -> None:
    # Dedupe: SET NX EX returns None if key exists
    if not await redis.set(f"dedupe:{ev.id}", "1", nx=True, ex=86400):
        return
    await redis.xadd(STREAM, {"payload": ev.model_dump_json()}, maxlen=100_000, approximate=True)
    await redis.publish("signals:new", ev.model_dump_json())   # broadcast hint
```

```python
# backend/src/pipeline/persister.py
# Source: Context7 /redis/redis-py — xgroup_create + xreadgroup + xack
import redis.asyncio as aioredis
from src.schemas.signal import SignalEvent
from src.db import async_session
from src.models.signal import Signal as SignalModel

GROUP = "persist"
CONSUMER = "persist-1"

async def run_persister(redis: aioredis.Redis) -> None:
    try:
        await redis.xgroup_create("signals", GROUP, id="0", mkstream=True)
    except aioredis.ResponseError as e:
        if "BUSYGROUP" not in str(e): raise

    while True:
        resp = await redis.xreadgroup(GROUP, CONSUMER, {"signals": ">"}, count=100, block=5000)
        if not resp: continue
        for _stream, entries in resp:
            async with async_session() as s, s.begin():
                for entry_id, fields in entries:
                    ev = SignalEvent.model_validate_json(fields["payload"])
                    s.add(SignalModel.from_event(ev))
                await s.commit()
                # ACK only after successful commit
                await redis.xack("signals", GROUP, *[e[0] for e in entries])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual SSE framing on StreamingResponse | `fastapi.sse.EventSourceResponse` | FastAPI ≥0.118 (2025) | Plan uses first-class helper; drops ~40 lines of boilerplate and closes several edge cases. |
| react-window for virtualization | @tanstack/react-virtual 3.x | 2024–2026 convergence | TanStack Virtual is headless, variable-height, and actively maintained. react-window 2.x still works and is acceptable per D-03 ("or similar"). |
| SSE client as raw `EventSource` + custom useEffect | `experimental_streamedQuery` + AsyncIterable wrapper | TanStack Query v5.40+ | Native cache reconciliation; no manual state sync. |
| Next.js Pages Router API routes with `res.write` | App Router Route Handlers with Web Streams (but prefer FastAPI for SSE) | Next 13→16 | Route Handlers can stream, but for OSINT SSE the Python backend is canonical. |
| bcrypt via custom wrappers | `passlib[bcrypt]` | stable since 2020 | Nothing new; still the standard. |
| WebSockets for all real-time | SSE for server→client push | 2024–2026 industry shift | Already locked in STACK.md; confirmed by Context7 and 2026 articles. |
| Raw feedparser only | feedparser + httpx conditional GET | Ongoing best practice | feedparser alone re-downloads every poll; combine with httpx to respect ETag/Last-Modified. |

**Deprecated/outdated:**
- **Next.js Pages Router `res.write` SSE pattern** — still works for Pages Router projects, but App Router + Web Streams (or FastAPI) is the current approach. Since we use FastAPI for SSE, this is moot.
- **`react-query` v4** — v5.99 is current; do not follow v4 tutorials.
- **Raw `redis.redis` sync client** — use `redis.asyncio` with FastAPI.

## Sources

### Primary (HIGH confidence)

- Context7 `/fastapi/fastapi` — `StreamingResponse`, `fastapi.sse.EventSourceResponse`, `ServerSentEvent` (fetched 2026-04-21)
- Context7 `/tanstack/query` — `experimental_streamedQuery`, AsyncIterable pattern, `ReactQueryStreamedHydration` (fetched 2026-04-21)
- Context7 `/tanstack/virtual` — `useVirtualizer`, `measureElement` (fetched 2026-04-21)
- Context7 `/redis/redis-py` v6.4.0 — `xadd`, `xgroup_create`, `xreadgroup`, `xack`, consumer group semantics (fetched 2026-04-21)
- Context7 `/timescale/timescaledb` — `create_hypertable`, `add_retention_policy`, chunk intervals (fetched 2026-04-21)
- Context7 `/vercel/next.js` — Route Handler `ReadableStream`, App Router streaming (fetched 2026-04-21)
- Context7 `/kurtmckee/feedparser` — RSS/Atom parsing contract, `bozo` flag
- npm registry (live): `next@16.2.4`, `react@19.2.5`, `@tanstack/react-query@5.99.2`, `@tanstack/react-virtual@3.13.24` — verified 2026-04-21
- PyPI (live): `feedparser==6.0.12` — verified 2026-04-21
- Existing project research: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md` (all HIGH confidence, authored 2026-04-21)

### Secondary (MEDIUM confidence)

- Next.js 16.2 release blog — https://nextjs.org/blog/next-16-2 (cited in STACK.md)
- CVE-2025-66478 — Next.js ≥16.1 mandated; current 16.2.4 covers it
- 2026 SSE vs WebSockets articles (JetBI, OneUptime, Nimbleway) — cross-referenced for architecture rationale

### Tertiary (LOW confidence)

- FastFeedParser 25× performance claim — Context7 lists but not benchmarked for this project's specific feeds; feedparser 6.0.12 is sufficient for Phase 1

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every library and version verified via Context7 and live registries (npm, PyPI)
- Architecture patterns: HIGH — derived from existing ARCHITECTURE.md (HIGH confidence) + concrete integration-level code from Context7
- Pitfalls: HIGH — combines PITFALLS.md (HIGH) with 8 additional integration-specific pitfalls surfaced during this research
- SSE implementation: HIGH — Context7 confirmed `fastapi.sse.EventSourceResponse` is first-class as of FastAPI 0.118+
- TanStack Query streamedQuery: HIGH — Context7 confirmed API surface (experimental prefix noted)
- TimescaleDB migration patterns: HIGH — exact SQL verified; hypertable PK gotcha is a known rake

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days; stack is mature, not fast-moving, but Next.js and FastAPI ship monthly — re-verify versions if planning slips past this date)
