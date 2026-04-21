# Research Summary

**Project:** GSD Shot Dashboard — OSINT Monitoring Dashboard
**Researched:** 2026-04-21
**Overall confidence:** HIGH on stack and architecture, MEDIUM-HIGH on features and pitfalls

---

## Executive Summary

GSD Shot Dashboard is a real-time OSINT aggregation dashboard that unifies 100+ public sources (social media, news, technical feeds) into a single analyst-facing view at sub-5s latency and 1000+ signals/min. Research converges strongly on a **five-layer streaming architecture** (connectors → normalization → event bus → persistence + SSE → presentation) built on a Python ingestion backend, Postgres + TimescaleDB for time-series storage, Redis Streams as the event bus, and a Next.js 16 + React 19 frontend consuming Server-Sent Events via TanStack Query.

The domain is dominated by one failure mode — **information overload and alert fatigue** — which shapes both the MVP (signal-over-noise primitives: dedup, corroboration, source health) and the anti-features (every-event-is-an-alert firehoses, kitchen-sink dashboards). A second cross-cutting concern is **platform API volatility**: Twitter/X pricing, Reddit API shifts, and Telegram MTProto-vs-Bot-API confusion have broken real products. This is addressed by a mandatory **Source Adapter pattern** from day one — every source is a hot-swappable plugin behind a canonical `SignalEvent` schema.

The strong build-order recommendation across all four research tracks is: **ship one end-to-end vertical slice** (one source — RSS — through the full pipeline) before broadening to more sources. The architecture's plugin contract makes adding sources cheap; a monolithic ingester rewritten later is expensive. Legal/compliance posture (GDPR lawful basis, 30-day retention, DSAR capability) must be designed into Phase 0/1, not retrofitted.

---

## Stack Recommendation

**Confidence: HIGH** (verified via Context7 across Next.js, TimescaleDB, TanStack Query, BullMQ, Meilisearch, Async PRAW)

### Core picks

- **Backend / ingestion:** Python 3.12 + FastAPI 0.115 + asyncio workers. Python's OSINT library ecosystem (Async PRAW, Telethon, feedparser, Playwright) is non-negotiable; forcing Node would mean rewriting wrappers.
- **Frontend:** Next.js 16.2+ (App Router) + React 19.2 + TypeScript 5.6 + Tailwind 4 + shadcn/ui. Next.js Route Handlers with Web Streams give first-class SSE support. **Must be ≥16.1 due to CVE-2025-66478.**
- **Real-time transport:** Server-Sent Events (SSE) over Redis Pub/Sub fanout. NOT WebSockets, NOT socket.io — the data flow is one-way (server → analyst) and SSE handles reconnect/proxy/CDN concerns natively.
- **Event bus + queue:** Redis 7.4 (Streams + Pub/Sub) with BullMQ 5.x (Node side) / arq 0.26 (Python side). One piece of infra serves queue + fanout + dedup cache.
- **Primary store:** PostgreSQL 16 + TimescaleDB 2.17 hypertables. `add_retention_policy('signals', INTERVAL '30 days')` implements the PROJECT.md retention cap in one line; continuous aggregates pre-compute dashboard stats.
- **Search:** Meilisearch 1.11 — typo-tolerant, sub-50ms, trivial ops. NOT Elasticsearch for v1 (JVM tuning, ILM overhead).
- **Frontend data layer:** TanStack Query v5 with `streamedQuery` for SSE + cache reconciliation.
- **Charts / tables / maps:** Recharts 2.x, TanStack Table v8, MapLibre GL JS 4.x (NOT Mapbox — licensing).
- **Deploy:** Docker Compose on a single VPS or Fly.io for v1. Defer Kubernetes.

### Key ADRs

- **Twitter/X:** Official API is economically infeasible (Basic $100/mo is inadequate; Pro $5K/mo is unjustifiable for v1). Use a third-party provider (twitterapi.io pay-as-you-go) behind the Source Adapter interface. **Re-verify provider at implementation time** — flag as phase-level research spike.
- **Kafka vs Redis Streams:** Redis Streams handles 1000 events/min on a laptop. Kafka adds Zookeeper/KRaft, topic management, and ops burden that delays shipping. Migration path is clean if/when volume exceeds ~50k events/sec.
- **Graph DB / Vector DB:** Defer. Entity correlation and semantic similarity are v2+ differentiators, not MVP. If added later, use `pgvector` to stay on Postgres.

---

## Table Stakes Features

**Confidence: HIGH** — every item attested by 3+ independently reviewed products (Liferaft, SMAT, ShadowDragon, Maltego, World Monitor, Recorded Future).

The MVP cannot ship without these:

| # | Feature | Why Required |
|---|---------|--------------|
| T1 | **Unified real-time feed** across all sources (sub-5s latency) | Core value prop; without live feed, it's just a link list |
| T2 | **Per-source connectors** (RSS + Reddit + 1 technical source for v1; Twitter/X + Telegram in Phase 2) | Named in PROJECT.md; expected from every OSINT tool |
| T3 | **Keyword / boolean search across all ingested items** | Universal expectation |
| T4 | **Filtering by source, time range, keyword, author** | Analysts cannot work without it |
| T5 | **Configurable alerts / notifications** | Named in PROJECT.md |
| T6 | **Source health / status indicators** | Named in PROJECT.md; prevents "green light illusion" |
| T7 | **Item detail with outbound link to original source** | Analysts must verify in-source; linking back builds trust |
| T8 | **Saved searches / watchlists** | Standard across Liferaft, Recorded Future, Maltego |
| T9 | **Timeline / chronological visualization** | Intel is inherently temporal |
| T10 | **Virtualized feed rendering** | Non-negotiable at 1000+ items/min |
| T11 | **Authentication / basic access control** | Single-user local login is acceptable for v1 |
| T12 | **Dark mode** | SOC/analyst workflow norm |

### Dependency chain

```
T2 (connectors) → T1 (unified feed) → T9 (timeline)
T1 → T3 (search) → T4 (filtering) → T8 (saved searches) → T5 (alerts)
T1 → T10 (virtualization)
T2 → T6 (source health)
```

### First differentiator to layer after MVP

**D3 — Deduplication / near-duplicate clustering.** Highest leverage against information overload; a news event reposted across 40 sources must become one card, not forty. This is what separates a feed reader from intelligence. Build in Phase 3 (or earlier if analyst feedback demands it).

### Explicitly defer to v2+

Cross-source entity correlation (D1), geospatial view (D4), role-based layouts (D6), AI summarization (D11), historical time-scrubbing (D12).

### Explicitly anti-feature (don't build, ever in v1)

Dark web / Tor crawling, automated takedown / response, mobile native app, >30-day archival, per-target credential storage, every-event-is-an-alert firehose, raw-log-dump UI, Maltego-style graph canvas, sentiment shown as authoritative truth.

---

## Architecture Pattern

**Confidence: HIGH** on the five-layer structure (universal across AWS, Kafka+Spark, and OSINT-specific references); MEDIUM on specific tech choices (depends on team familiarity).

### Five layers

```
Source Connectors → Normalization & Enrichment → Event Bus → Persistence + Query API + SSE Stream → Dashboard SPA
                                                           ↘ Alert Engine (bus consumer)
         ↑
 Source Registry & Health Monitor (cross-cuts connectors)
```

### Non-negotiable patterns

1. **Plugin / Connector Contract from day one.** Every source implements `SourceConnector { id, schedule, start(emit), stop(), health() }`. Adding a source = one file, not modifying the pipeline. Resist the temptation to hardcode the first source.
2. **Canonical `SignalEvent` schema.** Every source normalizes to `{ id, source_id, source_url, timestamp, ingested_at, author?, title?, content, tags[], geo?, score?, raw? }` **before** hitting the bus. Downstream never sees source-specific fields. This is the single most valuable decision in the system.
3. **Fail-isolated connectors.** Each connector runs in its own async task/process with its own retry + backoff + circuit breaker. A 429 from Twitter must not slow down Reddit ingestion.
4. **SSE (not WebSockets) for live push.** One-way server → client; auto-reconnect; `Last-Event-ID` resumption; works through proxies/CDNs.
5. **Server-side filter subscription.** Client sends filter spec on SSE connect; server only emits matching events. Never stream everything and let the browser filter — at 1000+ events/min it melts the tab.
6. **Event bus between ingestion and everything else.** Persistence, SSE fanout, search indexing, alert engine are all independent bus consumers. Never wire connectors directly to the database.
7. **Normalize at write time, keep `raw` for debugging only.** Treating raw API payloads as the canonical record means every schema change upstream breaks everything downstream.

### Anti-patterns to stop on sight

- Monolithic `ingest.py` pulling from all sources in one loop.
- Connector → direct DB write → dashboard polls DB.
- Client-side-only filtering of the SSE stream.
- `socket.emit()` called from the ingestion path.
- Raw source payloads stored as the canonical record.
- WebSockets chosen because "real-time was in the requirements."

---

## Critical Pitfalls

**Confidence: HIGH** on domain pitfalls (cross-verified across OSINT legal, API, and operational sources).

### Top 5 that must be prevented in Phase 0/1

1. **Signal volume ≠ signal validity.** A spike in mentions is *movement*, not *meaning*. Every signal card must expose source count, distinct author count, and a corroboration score. Single-source items must not trigger high-severity alerts by default. **Provenance + corroboration fields in the schema from day one** — retrofitting is painful.

2. **Platform API dependency without abstraction.** Reddit's 2023 API pricing shift killed Apollo overnight; Twitter's v1→v2 migration broke thousands of tools. **Source Adapter Interface is mandatory in Phase 1.** Zero `import twitter` outside the adapter module. Hot-swappable, config-driven, per-source cost/rate-limit tracked as first-class metrics.

3. **GDPR "it's public data" assumption.** Public ≠ free to aggregate + retain + process. Fines up to €20M / 4% global revenue. **Before Phase 1:** document lawful basis (legitimate interest is usual), design retention caps at the DB level (TimescaleDB 30-day policy), implement DSAR capability (ability to query + export + delete data on a person). Avoid special-category data (political/religious/health) without additional safeguards.

4. **Telegram Bot API vs MTProto.** Bot API **cannot** read arbitrary public channels the bot wasn't added to. Monitoring fundamentally requires MTProto (Telethon in Python). Decide this **before writing** the Telegram adapter; the operational cost (phone-registered account, session management, ban risk under aggressive polling) must be planned.

5. **Naive polling architecture (no queue, no backpressure).** Producer → Queue → Processor → Store → Broadcaster from Phase 1. Redis Streams is sufficient. Exponential backoff **with jitter** on all reconnects (synchronized reconnects = reconnect storms). Circuit breakers per adapter. Heartbeat per source visible in UI — a clean dashboard must not be confused with a broken collector.

### Also critical, but Phase 2+

6. **Deduplication failure.** Breaking news across 40 sources = 40 cards = the exact problem the dashboard was meant to solve, reproduced at the aggregation layer. Clustering layer (URL canonicalization + MinHash/SimHash text similarity + shared media hashes) is critical before handing to analysts.

### Cross-cutting red flags (if observed, stop and reassess)

- Source adapter imports outside the adapter package
- No per-source last-fetch timestamp on the dashboard
- Alerts without severity tier or aggregation
- No documented lawful basis in the repo
- Tokens in committed `.env` files
- Direct `socket.emit()` from ingestion to client
- A news event producing >10 separate cards

---

## Roadmap Implications

All four research tracks converge on a strict **vertical-slice-first** build order. The architecture's plugin contract makes horizontal expansion cheap; a monolithic foundation rewritten later is expensive.

### Suggested phase structure

**Phase 0 — Foundations (legal, ops, threat model)**
- Document GDPR lawful basis + DPIA posture
- Secret manager (Vault / Doppler / Infisical) — no tokens in repo
- OPSEC threat model (dedicated monitoring accounts, egress IP discipline)
- Repo scaffolding: monorepo or two-repo layout for Python backend + Next.js frontend
- Docker Compose skeleton (postgres+timescale, redis, meilisearch, api, workers, web)
- **Research flag: skip deeper research** — these are standard patterns with clear references.

**Phase 1 — Vertical Slice (end-to-end, one source)**
- Source Adapter Interface + first adapter (RSS — simplest, most reliable)
- Canonical `SignalEvent` schema (with provenance + corroboration fields)
- Redis Streams event bus
- TimescaleDB hypertable + 30-day retention policy (in initial migration)
- FastAPI REST endpoint for signals + SSE `/stream` endpoint
- Next.js shell + one dashboard tile consuming SSE via TanStack Query
- Per-source health heartbeat writing to Source Registry
- **Research flag: LIGHT research** — TanStack Query `streamedQuery` + SSE pattern is well-documented (Context7 verified), but team should spike the exact integration once.

**Phase 2 — Breadth (more sources)**
- Reddit adapter (Async PRAW)
- HN adapter (public API)
- Paste site adapter (RSS or direct poll with conditional GET)
- Meilisearch indexing as a separate bus consumer (NOT coupled to ingest path)
- Full-text search + basic filters in UI
- Virtualized feed (TanStack Table)
- **Research flag: SKIP** — these adapters are routine applications of the Phase 1 contract.

**Phase 3 — High-friction sources (Twitter/X + Telegram)**
- **Research spike REQUIRED before implementation:**
  - Twitter/X: confirm third-party provider choice (twitterapi.io, SociaVault, or alternative). Validate pricing, ToS, reliability as of build date.
  - Telegram: confirm MTProto + Telethon approach, account setup, ban-risk posture for monitoring cadence.
- Twitter adapter behind provider abstraction
- Telegram adapter (MTProto)
- **Research flag: DEEP research required** — platform volatility is the #1 risk here; defaults from Phase 1 research will be stale.

**Phase 4 — Signal quality (deduplication + clustering)**
- URL canonicalization
- MinHash/SimHash near-duplicate clustering
- Cluster cards (expandable source list) replace duplicate cards in UI
- Cluster growth rate as a differentiated signal (sets up anomaly detection later)
- **Research flag: MEDIUM research** — clustering algorithm selection (MinHash vs SimHash vs embeddings) warrants a focused spike.

**Phase 5 — Alerting & analyst workflow**
- Saved searches (T8)
- Alert engine as a bus consumer, with user-tunable thresholds
- Aggregated incidents (5 cluster hits = 1 incident, not 5 pings)
- Action audit log (analyst tags / dismisses / escalates)
- Timeline visualization
- **Research flag: LIGHT research** — standard patterns, but revisit alert-fatigue research before UX design.

**Phase 6 — Scale hardening (only if measurements demand it)**
- Split connectors into container-per-source
- Redis Streams consumer groups (horizontal SSE fanout)
- p99 latency alerting (not averages)
- Jittered backoff audit
- **Research flag: DEFER** — don't pre-optimize. Triggered by real load, not the roadmap.

### Research flags summary

| Phase | Research depth |
|-------|---------------|
| Phase 0 | SKIP (standard patterns) |
| Phase 1 | LIGHT (SSE + TanStack Query integration spike) |
| Phase 2 | SKIP (routine adapter work) |
| Phase 3 | **DEEP (Twitter/X provider + Telegram MTProto — platform volatility)** |
| Phase 4 | MEDIUM (clustering algorithm selection) |
| Phase 5 | LIGHT (alert-fatigue UX refresh) |
| Phase 6 | DEFER until measured |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | Context7-verified across Next.js 16.2, TimescaleDB, TanStack Query v5, BullMQ, Meilisearch, Async PRAW. CVE-2025-66478 requires Next.js ≥16.1. |
| **Features** | MEDIUM-HIGH | Table stakes verified across 3+ products each; differentiator priority ordering is opinionated but well-reasoned. |
| **Architecture** | MEDIUM-HIGH | Five-layer pattern is universal (AWS, OSINT, Kafka+Spark sources agree); specific tech choices (Redis vs Kafka) are scale-dependent and may shift with team familiarity. |
| **Pitfalls** | HIGH on legal/platform/API pitfalls (cross-verified); MEDIUM on specific numeric thresholds (e.g., dedup ratios). Context7 was not queried for pitfalls — relies on web + domain knowledge. |
| **Twitter/X provider choice** | MEDIUM | Pricing-aware recommendation; exact provider must be re-verified at Phase 3 implementation time. |

**Overall: HIGH on direction, MEDIUM on specific external-dependency choices.** The roadmapper should treat stack and architecture as settled, features as opinionated-but-defensible, and Twitter/Telegram integration as requiring a fresh research spike at Phase 3.

---

## Open Questions

Items that need user input or deferred validation:

1. **Deployment target.** Single VPS (Hetzner $40/mo) vs Fly.io vs team's existing cloud? Affects Phase 0 scaffolding but not architecture.
2. **Observability scope.** Is Prometheus + Grafana + Sentry the expected ops stack, or does the team have existing tooling to reuse? Affects Phase 1-2 instrumentation work but is not blocking.
3. **Initial Phase 1 source choice.** Research recommends **RSS** (simplest, most reliable, no auth). Confirm before Phase 1 kickoff. Reddit is a close second if RSS feels too uninteresting for a demo.
4. **Twitter/X third-party provider.** twitterapi.io pay-as-you-go is the current best candidate; SociaVault is the alternative. **Must be re-verified at Phase 3 implementation time** — pricing and ToS shift frequently. Flag as a phase-level research spike.
5. **Multi-user vs single-user auth for v1.** PROJECT.md phrasing suggests single-analyst is acceptable; a multi-user model would expand Phase 1 scope significantly. Confirm before Phase 1.
6. **GDPR / legal posture.** Is the deployment EU-facing? If yes, DPIA is formally required, not just advisable. Confirm jurisdiction before Phase 0.
7. **Historical time-scrubbing (D12) as a v1 or v2 feature.** Conflicts with the 30-day retention cap — if users need to replay past states, retention strategy must accommodate summaries/counts beyond 30 days even if raw content is dropped. Defer to v2 unless explicitly required.
8. **Map view (D4) as v1 or v2.** MapLibre GL JS is specified *if* map is built; geocoding pipeline is non-trivial. Recommend deferring unless analysts explicitly need geo.

---

## Sources

Aggregated from the four research files:

### Stack (Context7-verified)
- `/vercel/next.js` (16.2) + [Next.js 16 / 16.2 release notes](https://nextjs.org/blog/next-16-2), [streaming guide](https://nextjs.org/docs/app/guides/streaming)
- `/timescale/timescaledb` — retention policy + continuous aggregates SQL patterns
- `/taskforcesh/bullmq` — concurrency + rate limiting
- `/meilisearch/documentation` — indexing + faceted search
- `/tanstack/query` (v5.90.3) — `streamedQuery` for SSE consumption
- `/praw-dev/asyncpraw` — Reddit streaming
- CVE-2025-66478 (Next.js 13.x–16.x) — upgrade to ≥16.1 required

### Features (industry landscape)
- World Monitor Review 2026, ShadowDragon blog, Social Links blog, Liferaft Labs, Cybersecurity News, Wiz Academy
- Maltego (platform + Monitor), Recorded Future, Sintelix, Black Dot Solutions
- [awesome-osint](https://github.com/jivoi/awesome-osint), [Social-Media-OSINT-Tools-Collection](https://github.com/osintambition/Social-Media-OSINT-Tools-Collection)
- Alert-fatigue research: ACM Computing Surveys, IBM Think, DataBahn, Right-Hand

### Architecture
- JetBI "Streaming in 2026: SSE vs WebSockets vs RSC," OneUptime, Nimbleway (2026 guides)
- [ConduitIO plugin architecture ADR](https://github.com/ConduitIO/conduit), Logstash plugin model
- GetStream scalable activity feed, AWS social-media data pipeline guidance
- World Monitor (Dark Web Informer), Knowlesys OSINT risk dashboards
- Rivery, Monte Carlo data ingestion architecture guides

### Pitfalls
- LifeRaft Labs "9 Mistakes That Can Sabotage Investigations," CybelAngel "OSINT Done Right"
- GDPR: OSINT Central, Proelium Law, Blockint, Trustfull, Goodman Law
- Gravitee + emite on API rate limits; Ably + DEV + WebSocket.org on WebSocket scaling
- Telegram core.telegram.org (MTProto vs Bot API)
- Talent500 deduplication strategies, OneUptime TimescaleDB retention

Full source lists with URLs are preserved in `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, and `PITFALLS.md`.
