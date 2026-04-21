# Requirements: OSINT Shot Dashboard

**Defined:** 2026-04-21
**Core Value:** Real-time aggregation of disparate web intelligence sources into a single, actionable dashboard view.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [x] **FOUN-01**: Project skeleton with Docker Compose for all services (Python ingest, Next.js frontend, TimescaleDB, Redis)
- [x] **FOUN-02**: Canonical SignalEvent schema defined with provenance fields (source, timestamp, author, URL, confidence)
- [x] **FOUN-03**: Source Adapter pattern implemented as pluggable connector interface

### Ingestion

- [x] **INGS-01**: RSS/news feed connector ingesting items into the pipeline
- [ ] **INGS-02**: Reddit connector monitoring specified subreddits via public API
- [ ] **INGS-03**: Technical source connector (paste sites / HN) ingesting items
- [ ] **INGS-04**: Twitter/X connector via third-party adapter for public timeline monitoring
- [ ] **INGS-05**: Telegram connector monitoring public channels

### Data Pipeline

- [x] **PIPE-01**: Redis Streams event bus connecting ingest to consumers
- [x] **PIPE-02**: TimescaleDB persistence with 30-day retention policy
- [ ] **PIPE-03**: Meilisearch indexing as Redis Stream consumer for full-text search
- [x] **PIPE-04**: SSE endpoint streaming normalized events to frontend in real-time

### Dashboard UI

- [x] **DASH-01**: Unified real-time feed displaying items from all sources with sub-5s latency
- [x] **DASH-02**: Virtualized scrolling handling 1000+ items/min without performance degradation
- [x] **DASH-03**: Item detail view with original link, author, timestamp, and raw content
- [x] **DASH-04**: Dark mode as default UI theme
- [x] **DASH-05**: Source health indicators showing last-fetch, error count, and throughput per source

### Search & Filter

- [ ] **SRCH-01**: Full-text keyword search across all ingested items (AND/OR/NOT, phrase matching)
- [ ] **SRCH-02**: Filtering by source type, time range, keyword, and author
- [ ] **SRCH-03**: Saved searches / watchlists with persistent query storage

### Alerts

- [ ] **ALRT-01**: Configurable alert rules bound to saved searches or keyword matches
- [ ] **ALRT-02**: In-app notification delivery for triggered alerts
- [ ] **ALRT-03**: Alert rate-limiting to prevent notification fatigue

### Authentication

- [x] **AUTH-01**: User can log in with local credentials (single-user acceptable for v1)
- [x] **AUTH-02**: User session persists across browser refresh

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Signal Quality

- **SGNL-01**: Deduplication / near-duplicate clustering (MinHash/SimHash)
- **SGNL-02**: Source spike / anomaly detection with auto-alerting
- **SGNL-03**: AI-powered summarization of clusters or time windows

### Advanced Visualization

- **ADVZ-01**: Timeline / chronological visualization with time-scrubbing
- **ADVZ-02**: Geospatial view (events on a map)
- **ADVZ-03**: Role-based / customizable dashboard layouts

### Intelligence

- **INTL-01**: Cross-source entity correlation (username, URL, domain, hash)
- **INTL-02**: In-line enrichment (WHOIS, archive.org, link preview)

### Collaboration

- **COLB-01**: Export / reporting (CSV, JSON, PDF brief)
- **COLB-02**: Item annotations and tagging
- **COLB-03**: API access for programmatic query

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dark web / Tor crawling | Legal/compliance complexity; explicit PROJECT.md exclusion |
| Automated response / takedown workflows | v1 is monitoring only; widens attack surface |
| Mobile native app | Web-first approach; responsive UI sufficient |
| Historical archival beyond 30 days | Storage cost; compliance exposure |
| Per-target credential storage | Read-only public collection; security liability |
| Graph/link-analysis canvas (Maltego-style) | Enormous scope; competing with established tools |
| Sentiment shown as authoritative truth | Classifiers are noisy; misleads analysts |
| Private / paywalled source ingestion | PUBLIC sources only per project constraint |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Complete |
| FOUN-02 | Phase 1 | Complete |
| FOUN-03 | Phase 1 | Complete |
| INGS-01 | Phase 1 | Complete |
| PIPE-01 | Phase 1 | Complete |
| PIPE-02 | Phase 1 | Complete |
| PIPE-04 | Phase 1 | Complete |
| DASH-01 | Phase 1 | Complete |
| DASH-02 | Phase 1 | Complete |
| DASH-03 | Phase 1 | Complete |
| DASH-04 | Phase 1 | Complete |
| DASH-05 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| INGS-02 | Phase 2 | Pending |
| INGS-03 | Phase 2 | Pending |
| PIPE-03 | Phase 2 | Pending |
| SRCH-01 | Phase 2 | Pending |
| SRCH-02 | Phase 2 | Pending |
| INGS-04 | Phase 3 | Pending |
| INGS-05 | Phase 3 | Pending |
| SRCH-03 | Phase 3 | Pending |
| ALRT-01 | Phase 3 | Pending |
| ALRT-02 | Phase 3 | Pending |
| ALRT-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 after initial definition*
