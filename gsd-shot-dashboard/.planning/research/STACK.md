# Technology Stack

**Project:** OSINT Shot Dashboard
**Domain:** Real-time OSINT monitoring dashboard (social + news + technical sources)
**Researched:** 2026-04-21
**Overall confidence:** HIGH

---

## TL;DR — Opinionated Stack

**Pick this unless you have a specific reason not to:**

- **Backend / ingestion**: Python 3.12 + FastAPI + asyncio workers (NOT one Node service doing everything)
- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4
- **Real-time transport**: Server-Sent Events (SSE) via Next.js Route Handlers (NOT WebSockets, NOT socket.io)
- **Event bus + queue**: Redis 7.4 (Streams + Pub/Sub) with BullMQ 5.x for job orchestration
- **Primary store**: PostgreSQL 16 + TimescaleDB 2.17 extension (hypertables for signals, retention policy = 30 days to match PROJECT.md constraint)
- **Search**: Meilisearch 1.11 (NOT Elasticsearch for v1 — see rationale)
- **Frontend data layer**: TanStack Query v5 with `streamedQuery` for SSE + cache reconciliation
- **Charts / dashboard UI**: Recharts 2.x + TanStack Table v8 + shadcn/ui
- **Map view (if added)**: MapLibre GL JS 4.x (NOT Mapbox — licensing)
- **Deploy**: Docker Compose for dev, single VPS or Fly.io for v1 (defer Kubernetes)

This stack ships v1 in the scope of a few phases. It scales to the stated constraint (100+ sources, 1000+ data points/min) on a single $40/mo VPS and has a clean upgrade path (Redis Streams → Kafka, Meilisearch → OpenSearch, single-node Postgres → Timescale Cloud) when those become real problems.

---

## Recommended Stack (Detailed)

### Core Application

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Python** | 3.12+ | Ingestion workers, enrichment | Ecosystem dominance for OSINT — every Reddit/Telegram/RSS/scraping lib is Python-first. Async support mature. |
| **FastAPI** | 0.115+ | Backend HTTP API | Async-native, auto OpenAPI, Pydantic v2 validation. Fits SSE/streaming responses natively. |
| **Uvicorn** | 0.32+ | ASGI server | Production-grade async server for FastAPI. |
| **Pydantic** | 2.9+ | Data validation | Enforces source-schema normalization at ingress. Critical for aggregating heterogeneous sources. |
| **Next.js** | 16.2+ | Frontend framework | App Router + Route Handlers with Web Streams API = first-class SSE. Turbopack stable, React 19.2 View Transitions ideal for real-time UI. CVE-2025-66478 requires ≥16.1. |
| **React** | 19.2 | UI library | Paired with Next 16. View Transitions animate incoming signals without jank. |
| **TypeScript** | 5.6+ | Type safety (frontend) | Non-negotiable for dashboards with many signal shapes. |
| **Tailwind CSS** | 4.0+ | Styling | Dashboard density requires utility-first. v4 has native CSS-based config. |
| **shadcn/ui** | latest | Component primitives | Copy-paste, owns the code, no dependency bloat. Standard for dashboard UIs in 2026. |

**Confidence:** HIGH (all verified via Context7 / official Next.js 16.2 release notes)

### Real-Time Transport

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Server-Sent Events (SSE)** | n/a (browser spec) | Server → client streaming | OSINT is one-way push (server → analyst). SSE is simpler, auto-reconnecting, works through proxies/CDNs, integrates natively with Next.js Route Handlers via `ReadableStream`. WebSockets are overkill unless bidirectional. |
| **Redis Pub/Sub** | 7.4+ | Fanout from ingesters → API | Workers publish normalized signals; API SSE handlers subscribe. Decouples ingest from delivery. |

**Confidence:** HIGH (Next.js docs explicitly document SSE via Web Streams in Route Handlers; Redis Pub/Sub pattern is the canonical fanout).

**NOT using:** `socket.io` — adds a protocol abstraction layer nobody needs for one-way push, and its sticky-session requirements complicate horizontal scaling.

### Data Pipeline

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Redis** | 7.4+ | Job queue backbone, Streams, pub/sub, cache | One piece of infra does queue + fanout + dedupe cache. Streams give replayable, persistent event log suitable for 1000+ events/min. |
| **BullMQ** | 5.x | Job queue (Node workers, if any) | If a Node-side worker is needed (e.g., for Playwright scraping), BullMQ is the standard Redis-backed queue with concurrency controls, retries, rate limiting. |
| **arq** | 0.26+ | Python Redis job queue | Python equivalent of BullMQ. Async-native, simple API. Use for Python ingesters needing scheduled jobs. |
| **APScheduler** | 3.10+ | In-process scheduling | For source pollers that just need "every N minutes." Simpler than arq when persistence isn't required. |

**Confidence:** HIGH

**NOT using (for v1):** Apache Kafka / Redpanda. Kafka is the "right" answer at scale, but at 1000 events/min Redis Streams handles it on a laptop, and introducing Kafka adds Zookeeper/KRaft, topic management, schema registry, and operational burden that delays shipping. Migration path is clean when/if you exceed ~50k events/sec.

### Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL** | 16+ | Primary relational store | Boring, correct, excellent JSONB for heterogeneous source payloads, first-class async driver (`asyncpg`). |
| **TimescaleDB** | 2.17+ (extension) | Signals hypertable, retention, continuous aggregates | Signals are fundamentally time-series. `add_retention_policy('signals', INTERVAL '30 days')` implements the PROJECT.md 30-day cap in one line. Continuous aggregates pre-compute the "last hour / last 24h" stats the dashboard shows. |
| **asyncpg** | 0.30+ | Postgres async driver | Fastest Python Postgres driver. |
| **SQLAlchemy** | 2.x (async) | ORM / query layer | Optional but useful for migrations via Alembic. Use Core for hot paths, ORM for admin. |

**Confidence:** HIGH (TimescaleDB retention + continuous aggregates verified via Context7)

**NOT using:** A separate time-series DB (InfluxDB, QuestDB). Timescale gives you time-series *and* relational in one database. One less thing to operate.

### Search & Filtering

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Meilisearch** | 1.11+ | Full-text + faceted search across all signals | Typo-tolerant, sub-50ms queries, trivial ops (single binary), native faceted filters — perfect for "search and filtering across all sources" requirement. Handles the v1 scale (millions of docs) on one node. |

**Confidence:** HIGH

**NOT using (for v1):** Elasticsearch / OpenSearch. They are more powerful but require JVM tuning, index lifecycle management, and a dedicated ops budget. Meilisearch gets you 90% of dashboard search needs at 10% of the operational cost. Migration path: if you later need aggregations / ML / log-style queries, swap in OpenSearch without changing the API contract.

### Source Ingestion Libraries

| Source Type | Library | Version | Notes |
|------------|---------|---------|-------|
| **Reddit** | Async PRAW | 7.8+ | Official async wrapper, supports streaming new submissions/comments. |
| **Twitter/X** | **See ADR below** | — | Official API is economically infeasible for OSINT volumes. |
| **Telegram** | Telethon | 1.37+ | Userbot-style, full MTProto access for public channels. |
| **RSS / Atom / news** | feedparser | 6.0+ | Standard. Pair with `httpx` for polling. |
| **Paste sites** | custom + `httpx` | — | No official lib; roll per-source poller with conditional GET. |
| **Generic web / JS-heavy** | Playwright (Python) | 1.48+ | Only when static fetch fails — expensive, run in dedicated worker pool. |
| **HTTP client (async)** | httpx | 0.27+ | Standard async HTTP. |

**Confidence:** HIGH (PRAW/Async PRAW verified via Context7)

#### ADR: Twitter/X Data Access

The official X API in 2026 offers Free ($0, severely limited), Basic ($100/mo for 10K tweets), Pro ($5,000/mo), and Enterprise ($42,000+/mo). The jump from Basic to Pro with no intermediate tier is the well-known "research cliff." Given the PROJECT.md scale target (1000+ signals/min across 100+ sources), the Basic tier is inadequate and Pro is economically unjustifiable for v1.

**Recommendation for v1:** Use a third-party Twitter data provider (e.g., **twitterapi.io** pay-as-you-go at ~$0.15/1K tweets, or **SociaVault**) behind an adapter interface. Treat Twitter as a pluggable source so the provider can be swapped without touching the pipeline. Flag as a **phase-level research item** before implementation — ToS and reliability shift frequently.

### Frontend Data & UI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **TanStack Query** | v5.90+ | Server-state management, SSE integration | `streamedQuery` helper consumes SSE/AsyncIterable natively and reconciles with cache. Pairing SSE + TanStack Query is the 2026 real-time dashboard pattern. |
| **Zustand** | 5.x | Local UI state (filters, layout) | Minimal API, no boilerplate. Don't use Redux for this scope. |
| **Recharts** | 2.13+ | Time-series + categorical charts | React-native, composable, good defaults. Sufficient for v1 dashboard charts. |
| **Apache ECharts** | 5.5+ (optional) | Heavy charts if Recharts hits limits | Upgrade path only — don't start here. |
| **TanStack Table** | v8 | Signal feed / data grids | Headless, virtualized, handles 10k+ rows. |
| **MapLibre GL JS** | 4.x | Geo view (if geolocated signals) | Open-source, no Mapbox license tax. Canonical choice in OSINT dashboards (Shadowbroker, Phantom Tide). |
| **date-fns** | 4.x | Time formatting | Tree-shakeable, replaces moment. |

**Confidence:** HIGH (TanStack Query verified via Context7)

### Observability

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **OpenTelemetry** | latest | Tracing / metrics | Vendor-neutral. Instrument ingesters to surface "source health" in the dashboard (addresses the "source health indicators" requirement). |
| **Prometheus** + **Grafana** | stable | Ops dashboards | Standard. Separate from the analyst-facing dashboard. |
| **Sentry** | SaaS | Error tracking | Catches scraper breakages fast — sources change HTML/API schemas often. |

**Confidence:** MEDIUM (standard choices, but scoping observability is an ops decision)

### Deployment / Infra

| Technology | Purpose | Why |
|------------|---------|-----|
| **Docker Compose** | Local dev + single-host prod | Six services (Postgres+Timescale, Redis, Meilisearch, API, workers, Next.js) fit comfortably. Don't start on Kubernetes. |
| **Fly.io** or **Hetzner VPS** | v1 hosting | One machine with Docker Compose satisfies the stated scale. Upgrade to managed Postgres / Kubernetes later only if pain emerges. |
| **GitHub Actions** | CI | Standard. |

**Confidence:** MEDIUM (infrastructure choice depends on team preferences; principle is "keep it flat for v1")

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Language (backend) | Python | Node.js / TypeScript monolith | OSINT library ecosystem is Python-first (PRAW, Telethon, spaCy, Scrapy). Forcing Node means rewriting wrappers. |
| Real-time transport | SSE | WebSockets / socket.io | SSE is simpler for one-way push, auto-reconnects, proxy/CDN friendly. WS required only if client → server messages needed at real-time cadence. |
| Real-time transport | SSE | Long polling | Polling can't meet the 5-second freshness constraint cleanly at 100+ sources. |
| Event bus | Redis Streams | Apache Kafka / Redpanda | Kafka is right at scale; overkill for 1000 events/min. Adds weeks of ops work. |
| Time-series store | TimescaleDB | InfluxDB / QuestDB | Timescale = Postgres + time-series. Fewer systems to run. |
| Search | Meilisearch | Elasticsearch / OpenSearch | ES is more powerful, but heavier to operate. Meilisearch covers dashboard search needs. |
| Search | Meilisearch | Typesense | Both are viable; Meilisearch has larger community and better TypeScript SDK in 2026. |
| Frontend framework | Next.js 16 | SvelteKit / Remix / Vite SPA | Next.js App Router has first-class SSE via Web Streams, best React ecosystem, server components reduce client JS. |
| Orchestration | Docker Compose | Kubernetes | K8s is premature. One-box deployment is sufficient for v1 scale. |
| ORM | SQLAlchemy 2 (async) | Prisma (Node) / Drizzle | If backend is Python, use SQLAlchemy. Don't split ORMs across languages. |
| Graph DB | None (v1) | Neo4j | Defer — entity relationship analysis is a v2+ feature, not a table-stakes requirement. |
| Vector DB | None (v1) | Qdrant / pgvector | Defer — semantic similarity is a differentiator, not MVP. If added, use `pgvector` to stay on Postgres. |

---

## What NOT to Use (And Why)

- **socket.io** — Wrong abstraction for one-way push; complicates scaling.
- **Kafka / Redpanda (in v1)** — Real ops cost for scale you don't have yet.
- **Elasticsearch (in v1)** — JVM, heap tuning, ILM policies; Meilisearch gets you there faster.
- **MongoDB** — No good reason over Postgres+JSONB; loses transactions and Timescale.
- **Prisma** — Fine tool, but if backend is Python, it's the wrong choice.
- **Mapbox GL JS** — Licensing tax; MapLibre is the free fork used in OSINT dashboards.
- **Kubernetes (in v1)** — Premature. One VPS with Compose handles the stated load.
- **Neo4j / graph DB (in v1)** — Not a table-stakes feature; add when entity-relationship analysis is explicitly required.
- **Official X API Pro tier ($5K/mo)** — Economically infeasible for this project; use third-party adapter.
- **Scraping behind login on any platform** — ToS violation, legal/compliance risk, conflicts with PROJECT.md "public sources only" constraint.

---

## Installation (Reference)

### Backend (Python)

```bash
# Using uv (recommended in 2026)
uv init osint-backend
uv add fastapi uvicorn[standard] pydantic asyncpg sqlalchemy[asyncio] \
       redis arq httpx feedparser asyncpraw telethon \
       opentelemetry-api opentelemetry-sdk sentry-sdk
uv add --dev pytest pytest-asyncio ruff mypy
```

### Frontend (Next.js)

```bash
npx create-next-app@latest osint-dashboard --typescript --tailwind --app --eslint
cd osint-dashboard
npm install @tanstack/react-query @tanstack/react-table zustand \
            recharts date-fns maplibre-gl
npx shadcn@latest init
```

### Infrastructure (Docker Compose)

```yaml
# Required images — pin exact versions in real compose file
services:
  postgres:   # timescale/timescaledb:2.17.2-pg16
  redis:      # redis:7.4-alpine
  meilisearch:# getmeili/meilisearch:v1.11
  api:        # python:3.12-slim (built from repo)
  workers:    # python:3.12-slim (built from repo)
  web:        # node:22-alpine → next start
```

---

## Implications for Roadmap

1. **Phase 1 must establish the ingest → store → stream spine end-to-end with one source.** Don't try to add three sources in parallel — prove Redis Pub/Sub → SSE → TanStack Query works with RSS (cheapest/most reliable source) first.
2. **Twitter/X integration needs its own research spike** before implementation — flag this phase for deeper research.
3. **Playwright-based scrapers need a dedicated worker pool** and should come after HTTP-based sources work. Don't mix them.
4. **TimescaleDB retention policy should be applied in the initial schema migration**, not bolted on later. It's trivial now, painful to backfill.
5. **Meilisearch indexing should be a Redis Stream consumer** (sink), not coupled to the ingest path directly — keeps ingest fast, search eventually-consistent.

---

## Sources

- **Next.js streaming / SSE (HIGH):** Context7 `/vercel/next.js`, [Next.js 16 blog](https://nextjs.org/blog/next-16), [Next.js 16.2 blog](https://nextjs.org/blog/next-16-2), [Streaming guide](https://nextjs.org/docs/app/guides/streaming)
- **TimescaleDB retention + continuous aggregates (HIGH):** Context7 `/timescale/timescaledb`
- **BullMQ concurrency (HIGH):** Context7 `/taskforcesh/bullmq`
- **Meilisearch (HIGH):** Context7 `/meilisearch/documentation`
- **TanStack Query v5 (HIGH):** Context7 `/tanstack/query` (v5.90.3)
- **PRAW / Async PRAW (HIGH):** Context7 `/praw-dev/asyncpraw`
- **Twitter/X API pricing reality (MEDIUM):** [Xpoz pricing guide](https://www.xpoz.ai/blog/guides/understanding-twitter-api-pricing-tiers-and-alternatives/), [TwitterAPI.io pricing](https://twitterapi.io/blog/twitter-api-pricing-2025), [ScrapeCreators](https://scrapecreators.com/blog/how-to-scrape-twitter-x-api-2025)
- **OSINT dashboard reference architecture (MEDIUM):** [Shadowbroker HN discussion](https://news.ycombinator.com/item?id=47300102), [Social-Media-OSINT-Tools-Collection](https://github.com/osintambition/Social-Media-OSINT-Tools-Collection), [awesome-osint](https://github.com/jivoi/awesome-osint)
- **Security (HIGH):** CVE-2025-66478 (Next.js 13.x–16.x) — upgrade to ≥16.1 required

## Confidence Levels

| Recommendation | Confidence | Verified via |
|----------------|------------|--------------|
| Next.js 16.2 + SSE via Route Handlers | HIGH | Context7 + official blog |
| TimescaleDB for signals + 30-day retention | HIGH | Context7 (exact SQL pattern exists) |
| Redis Streams + Pub/Sub for v1 event bus | HIGH | Ecosystem consensus + PROJECT.md scale numbers |
| Meilisearch over Elasticsearch for v1 | HIGH | Feature parity for dashboard use case verified |
| TanStack Query v5 `streamedQuery` for SSE client | HIGH | Context7 (library + version confirmed) |
| Python ingestion (vs Node) | HIGH | Library ecosystem analysis |
| Async PRAW for Reddit | HIGH | Context7 |
| Third-party Twitter provider (not official API) | MEDIUM | Multiple 2025/2026 sources corroborate pricing; exact provider should be re-verified at implementation time |
| Docker Compose / single-VPS deploy for v1 | MEDIUM | Opinion based on stated scale; team infra preferences may vary |
| MapLibre GL (if map view built) | HIGH | Licensing + ecosystem usage confirmed |
