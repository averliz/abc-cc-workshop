# OSINT Shot Dashboard

## What This Is

A real-time OSINT monitoring dashboard that aggregates and visualizes web intelligence from social media, news, and technical sources into a single unified interface. Built for analysts and security professionals who need to track signals across multiple intelligence sources without switching between tools.

## Core Value

Real-time aggregation of disparate web intelligence sources into a single, actionable dashboard view.

## Requirements

### Validated

- ✓ Real-time data aggregation from RSS sources — Validated in Phase 1
- ✓ News feed ingestion and display — Validated in Phase 1
- ✓ Unified dashboard visualization — Validated in Phase 1
- ✓ Source health and status indicators — Validated in Phase 1

### Active

- [ ] Real-time data aggregation from multiple web sources (Reddit, Twitter/X, Telegram)
- [ ] Social media monitoring (Twitter/X, Reddit, Telegram)
- [ ] News feed ingestion and display (additional sources beyond RSS)
- [ ] Technical source monitoring (paste sites, forums, code repos)
- [ ] Unified dashboard visualization
- [ ] Configurable alert/notification system
- [ ] Search and filtering across all sources
- [ ] Source health and status indicators

### Out of Scope

- Mobile native app — web-first approach for v1
- Historical data archival beyond 30 days — storage cost concerns
- Automated response/action workflows — v1 is monitoring only
- Dark web crawling — legal/compliance complexity

## Context

OSINT (Open Source Intelligence) dashboards serve analysts who need to correlate signals across public web sources. The tool must handle high-volume data streams, present information in a digestible format, and enable rapid identification of relevant signals from noise. Real-time updates are critical — stale intelligence loses value quickly.

## Constraints

- **Data Sources**: Must use publicly available APIs and feeds only
- **Performance**: Dashboard must update within 5 seconds of source data availability
- **Scale**: Handle 100+ sources with 1000+ data points per minute
- **Security**: No stored credentials for monitored targets; read-only collection

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web-based dashboard | Accessibility, no install friction | — Pending |
| Real-time over batch | Intelligence value degrades with latency | — Pending |
| Public sources only | Legal compliance, reduced risk | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-21 after Phase 1 completion*
