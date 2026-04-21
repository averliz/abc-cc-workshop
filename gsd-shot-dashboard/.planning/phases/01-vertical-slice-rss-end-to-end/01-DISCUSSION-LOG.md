# Phase 1: Vertical Slice (RSS end-to-end) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 01-vertical-slice-rss-end-to-end
**Areas discussed:** Dashboard layout, Feed item presentation, Source health display, Authentication UX
**Mode:** Auto (all decisions selected as recommended defaults)

---

## Dashboard Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Single-panel feed with sidebar | Simplest layout proving core value; feed dominates, health in sidebar | ✓ |
| Multi-panel split view | Feed + detail + health all visible simultaneously | |
| Tabbed interface | Separate tabs for feed, health, settings | |

**User's choice:** Single-panel feed with sidebar (auto-selected: recommended default)
**Notes:** Research supports minimal initial layout — avoid kitchen-sink anti-pattern (A7 in FEATURES.md).

---

## Feed Item Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Compact cards | Source icon, title, timestamp, 2-line preview; color-coded per source | ✓ |
| Full-content cards | Show complete item content inline | |
| List rows | Minimal table-like rows for maximum density | |

**User's choice:** Compact cards (auto-selected: recommended default)
**Notes:** Balances readability with density at 1000+ items/min. Virtualization required regardless of choice.

---

## Source Health Display

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar panel | Always-visible right sidebar with per-source badges | ✓ |
| Top bar indicators | Compact status row above the feed | |
| Separate page | Dedicated health/status page accessible via nav | |

**User's choice:** Sidebar panel (auto-selected: recommended default)
**Notes:** Always-visible health aligns with analyst workflow — detecting source failures immediately is table stakes (T6).

---

## Authentication UX

| Option | Description | Selected |
|--------|-------------|----------|
| Email/password with httpOnly cookie | Simple, secure, minimal friction | ✓ |
| Magic link (passwordless) | More modern but requires email infra | |
| Basic HTTP auth | Simplest possible but poor UX | |

**User's choice:** Email/password with httpOnly cookie (auto-selected: recommended default)
**Notes:** Single-user acceptable for v1 per PROJECT.md. No OAuth complexity needed.

---

## Claude's Discretion

- Docker Compose topology
- Python ingestion framework
- Database migration tooling
- Redis Streams configuration
- SSE implementation details
- SignalEvent schema field names
- Frontend component library
- Test framework

## Deferred Ideas

None — auto mode stayed within phase scope.
