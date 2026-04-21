# Phase 1: Vertical Slice (RSS end-to-end) - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the full end-to-end pipeline: RSS connector → canonical SignalEvent schema → Redis Streams → TimescaleDB (30-day retention) → SSE → Next.js dark-mode dashboard with virtualized feed, item detail, source health panel, and local auth. One source (RSS), full architecture.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Layout
- **D-01:** Single-panel feed layout with a sidebar for source health. No multi-panel or tabbed layouts in v1 — prove the core value with the simplest effective layout.

### Feed Item Presentation
- **D-02:** Compact card format per item: source icon, title/headline, timestamp (relative), and 2-line content preview. Cards should be visually distinct per source type (color-coded left border or icon).
- **D-03:** Virtualized rendering mandatory from day one — react-window or similar. "Pause stream" affordance when user is reading older items.

### Source Health Display
- **D-04:** Sidebar panel (right side) showing per-source status: last-fetch timestamp, error count, throughput (items/min). Always visible alongside feed. Status badges: green/yellow/red.

### Authentication UX
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `.planning/research/ARCHITECTURE.md` — Five-layer streaming pattern, component boundaries, SSE rationale
- `.planning/research/STACK.md` — Technology choices with versions, ADRs for SSE vs WebSocket, Redis vs Kafka, TimescaleDB rationale

### Features & Pitfalls
- `.planning/research/FEATURES.md` — Table stakes T1-T12, dependency graph, MVP recommendation
- `.planning/research/PITFALLS.md` — Critical pitfalls (Source Adapter pattern non-negotiable, queue-based architecture, GDPR considerations)

### Project
- `.planning/PROJECT.md` — Core value, constraints (5s latency, 100+ sources, 1000+ items/min, public sources only)
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: FOUN-01..03, INGS-01, PIPE-01/02/04, DASH-01..05, AUTH-01/02

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None (greenfield project — no existing code)

### Established Patterns
- None yet — Phase 1 establishes all patterns

### Integration Points
- This phase creates the foundation all subsequent phases build on
- Source Adapter contract designed here must accommodate Reddit, HN, Twitter/X, Telegram in Phases 2-3
- Redis Streams consumer pattern must support adding Meilisearch consumer in Phase 2

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Research recommends:
- SSE over WebSockets (one-way server→client, HTTP/2 compatible, auto-reconnect)
- TimescaleDB continuous aggregates for dashboard metrics
- Source Adapter as isolated plugin with own retry/backoff
- Next.js 16.2+ (CVE-2025-66478 requires ≥16.1)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-vertical-slice-rss-end-to-end*
*Context gathered: 2026-04-21*
