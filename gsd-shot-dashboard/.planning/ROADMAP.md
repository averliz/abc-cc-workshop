# Roadmap: OSINT Shot Dashboard

**Created:** 2026-04-21
**Granularity:** coarse (3-5 phases, 1-3 plans each)
**Mode:** yolo
**Core Value:** Real-time aggregation of disparate web intelligence sources into a single, actionable dashboard view.

## Strategy

Derived from research: strict **vertical-slice-first** build order. Phase 1 ships one source (RSS) end-to-end through the full pipeline to prove the architecture (Source Adapter contract, canonical `SignalEvent`, Redis Streams bus, TimescaleDB retention, SSE to UI, auth, dark-mode UI). Phase 2 exploits the plugin contract to add breadth (Reddit, HN/paste) and layers full-text search + filtering as a bus consumer. Phase 3 tackles the high-friction platforms (Twitter/X via third-party provider, Telegram MTProto) and closes out analyst workflow with saved searches + alerting.

This ordering matches the research recommendation exactly and keeps the highest-risk platform work (API volatility, ToS / ban posture) at the end, where a fresh research spike can precede implementation.

## Phases

- [ ] **Phase 1: Vertical Slice (RSS end-to-end)** — Foundation, SignalEvent schema, Source Adapter contract, RSS ingestion, Redis Streams, TimescaleDB persistence, SSE stream, unified dashboard with source health, auth, dark mode
- [ ] **Phase 2: Breadth + Search** — Reddit + technical (HN/paste) adapters, Meilisearch indexing as bus consumer, full-text search, source/time/keyword/author filtering
- [ ] **Phase 3: High-Friction Sources + Alerts** — Twitter/X (third-party provider) + Telegram (MTProto) adapters, saved searches/watchlists, configurable alert rules with in-app notifications and rate limiting

## Phase Details

### Phase 1: Vertical Slice (RSS end-to-end)
**Goal**: A single analyst can log in and watch RSS items flow into a unified dark-mode dashboard in real time, with source health visible and item details one click away.
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, INGS-01, PIPE-01, PIPE-02, PIPE-04, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. A user logs in with local credentials and their session survives a browser refresh.
  2. RSS items appear in the unified dashboard feed within 5 seconds of being published upstream, streamed via SSE.
  3. The feed remains smooth (virtualized) as items accumulate at 1000+ items/min, with dark mode as the default theme.
  4. Clicking any item reveals its detail view with original link, author, timestamp, and raw content.
  5. The dashboard shows a source health panel with last-fetch time, error count, and throughput for the RSS connector.
  6. Every ingested item conforms to the canonical `SignalEvent` schema (with provenance fields) and flows connector → Redis Streams → TimescaleDB (30-day retention) → SSE — no connector writes directly to the DB.
**Plans:** 3/5 plans executed
Plans:
- [x] 01-01-PLAN.md — Docker Compose topology (Timescale + Redis + Caddy), Alembic baseline, signals hypertable + 30-day retention migration, environment smoke check [FOUN-01, PIPE-02]
- [x] 01-02-PLAN.md — FastAPI app skeleton, canonical SignalEvent + Provenance schema, SourceConnector Protocol, auth (bcrypt + signed httpOnly cookie), create-user CLI [FOUN-02, FOUN-03, AUTH-01, AUTH-02]
- [x] 01-03-PLAN.md — RSS connector with feedparser + httpx conditional GET, publisher (XADD + dedupe + PUBLISH), persister + broadcaster consumer groups, worker entrypoint [INGS-01, PIPE-01]
- [x] 01-04-PLAN.md — GET /api/signals backfill, GET /api/stream SSE via EventSourceResponse + Last-Event-ID replay, GET /api/sources/health, scripts/load_generator.py [PIPE-04, DASH-05]
- [x] 01-05-PLAN.md — Next.js 16.2 dashboard: login page, dark theme default, SSE streamedQuery hook, virtualized feed with pause toggle, item detail drawer, source health sidebar, Playwright E2E [DASH-01, DASH-02, DASH-03, DASH-04, AUTH-01, AUTH-02]
**UI hint**: yes

### Phase 2: Breadth + Search
**Goal**: The analyst monitors multiple source types simultaneously and can quickly find relevant items by keyword, source, time, or author.
**Depends on**: Phase 1
**Requirements**: INGS-02, INGS-03, PIPE-03, SRCH-01, SRCH-02
**Success Criteria** (what must be TRUE):
  1. Reddit items from configured subreddits appear in the unified feed alongside RSS, normalized to the same `SignalEvent` schema.
  2. Items from a technical source (paste site or HN) appear in the unified feed alongside RSS and Reddit.
  3. The analyst runs a full-text keyword search (AND/OR/NOT, phrase matching) across all ingested items and gets sub-second results.
  4. The analyst filters the feed by source type, time range, keyword, and author, and the filters compose correctly.
  5. Meilisearch indexing runs as an independent Redis Streams consumer — ingestion throughput is unaffected by search index state.
**Plans**: TBD
**UI hint**: yes

### Phase 3: High-Friction Sources + Alerts
**Goal**: The analyst covers the hardest-to-monitor platforms (Twitter/X, Telegram) and is notified when saved queries match new signals, without alert fatigue.
**Depends on**: Phase 2
**Requirements**: INGS-04, INGS-05, SRCH-03, ALRT-01, ALRT-02, ALRT-03
**Success Criteria** (what must be TRUE):
  1. Public Twitter/X timelines stream into the unified feed via a third-party adapter, hidden behind the same Source Adapter contract.
  2. Public Telegram channels stream into the unified feed via an MTProto adapter (Telethon), with ban-risk-aware polling cadence.
  3. The analyst saves a search/watchlist with a persistent query and returns to it later without redefining filters.
  4. Alert rules bound to saved searches or keyword matches fire in-app notifications when new matching items arrive.
  5. Alert rate-limiting prevents notification fatigue — repeated matches within a configured window aggregate into a single notification.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Vertical Slice (RSS end-to-end) | 3/5 | In Progress|  |
| 2. Breadth + Search | 0/0 | Not started | - |
| 3. High-Friction Sources + Alerts | 0/0 | Not started | - |

## Coverage

- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

| Phase | Requirements | Count |
|-------|--------------|-------|
| Phase 1 | FOUN-01, FOUN-02, FOUN-03, INGS-01, PIPE-01, PIPE-02, PIPE-04, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, AUTH-01, AUTH-02 | 14 |
| Phase 2 | INGS-02, INGS-03, PIPE-03, SRCH-01, SRCH-02 | 5 |
| Phase 3 | INGS-04, INGS-05, SRCH-03, ALRT-01, ALRT-02, ALRT-03 | 6 |
| **Total** | | **25** |

## Research Flags (from research/SUMMARY.md)

| Phase | Research depth | Notes |
|-------|----------------|-------|
| Phase 1 | LIGHT | SSE + TanStack Query `streamedQuery` integration spike |
| Phase 2 | SKIP | Routine adapter work on the Phase 1 contract |
| Phase 3 | **DEEP** | Twitter/X provider choice (twitterapi.io vs alt) + Telegram MTProto ban-risk posture — re-verify at implementation time |

---
*Roadmap generated: 2026-04-21*
*Last updated: 2026-04-20 — Phase 1 plans 01-01 and 01-02 complete; 01-03..01-05 pending*
