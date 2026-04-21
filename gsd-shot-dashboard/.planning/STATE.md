---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: Not started
status: planning
last_updated: "2026-04-20T18:52:56.390Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State: OSINT Shot Dashboard

**Last updated:** 2026-04-20

## Project Reference

**Core value:** Real-time aggregation of disparate web intelligence sources into a single, actionable dashboard view.

**Current focus:** Phase 01 — vertical-slice-rss-end-to-end

## Current Position

Phase: 01 (vertical-slice-rss-end-to-end) — READY FOR VERIFICATION
Current Plan: Not started
Total Plans in Phase: 5

- **Milestone:** v1
- **Phase:** 2
- **Plan:** 01-05 complete — all 5 plans shipped
- **Status:** Ready to plan
- **Progress:** [██████████] 100%

```
[ ] Phase 1: Vertical Slice (RSS end-to-end)   ← current
[ ] Phase 2: Breadth + Search
[ ] Phase 3: High-Friction Sources + Alerts
```

**Requirement coverage:** 25 / 25 v1 requirements mapped (0 orphans).

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 3 |
| Phases complete | 0 |
| v1 requirements | 25 |
| v1 requirements mapped | 25 |
| v1 requirements complete | 16 (FOUN-01, FOUN-02, FOUN-03, PIPE-01, PIPE-02, PIPE-04, AUTH-01, AUTH-02, INGS-01, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05) — AUTH-01/02 fully covered with UX in Plan 01-05 |
| Plans executed | 5 |

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| 01-01 | 5 min | 3 | 17 |
| 01-02 | 4 min | 3 | 31 |
| 01-03 | 6 min | 3 | 11 |
| 01-04 | 5 min | 3 | 9 |
| Phase 01 P05 | 12 min | 3 tasks | 34 files |

## Accumulated Context

### Key Decisions (from PROJECT.md + research)

| Decision | Rationale |
|----------|-----------|
| Web-based dashboard (not mobile) | Accessibility, no install friction |
| Real-time (SSE) not batch | Intelligence value degrades with latency |
| Public sources only | Legal compliance, reduced risk |
| Single-user local auth acceptable for v1 | Scope reduction; defer multi-user to v2 |
| Python backend + Next.js frontend | Python OSINT ecosystem is non-negotiable |
| Redis Streams (not Kafka) as event bus | Sufficient for 1000 events/min; ops simpler |
| TimescaleDB 30-day retention policy | Implements PROJECT.md cap in SQL |
| SSE (not WebSockets) for push | One-way data flow; proxy/CDN friendly |
| Source Adapter pattern from day one | Platform API volatility (Twitter/X, Reddit, Telegram) |
| Vertical slice first (RSS) | Plugin contract makes breadth cheap; monolith rewrite is expensive |
| Third-party Twitter/X provider | Official API economically infeasible for v1 |
| timescale/timescaledb:latest-pg17 image (not vanilla postgres) | Extension pre-installed, closes Pitfall 11 at image layer (Plan 01-01) |
| Caddy (not nginx/Traefik) for reverse proxy | 15-line Caddyfile; `flush_interval -1` + 24h timeouts close Pitfalls 6/8/12 (Plan 01-01) |
| Composite hypertable PK `(id, ingested_at)` on signals | TimescaleDB requires partition column in any unique constraint (Plan 01-01, Pitfall 1) |
| Two DATABASE_URLs (async + sync) | asyncpg for runtime, psycopg2 for Alembic (sync-only tool) (Plan 01-01) |
| `email-validator` pinned as explicit backend dep | pydantic EmailStr requires it at runtime; pydantic>=2.9 doesn't pull it transitively (Plan 01-02) |
| SourceConnector is a `@runtime_checkable` Protocol (not an ABC) | Adapters match shape; no base-class inheritance required (Plan 01-02) |
| Session cookie uses fixed salt `osint.session.v1` (not Settings-derived) | Salts are not secret; versioning gives a global-invalidation path (Plan 01-02) |
| `verify_session_cookie` returns `int | None` (never raises) | `require_user` + future SSE handlers treat missing/tampered/expired identically (Plan 01-02) |
| Two-consumer-group split on signals stream (persist + broadcast) | Decouples 5s SSE SLA from DB latency; DB slowness never blocks Pub/Sub fanout (Plan 01-03, RESEARCH Pattern 3) |
| XACK-after-commit in persister (not before) | Failed commit leaves message pending; xreadgroup redelivers — built-in retry, no explicit DLQ for Phase 1 (Plan 01-03) |
| `s.merge` (not INSERT ON CONFLICT) for signals upsert | Clean idempotent path on composite hypertable PK; at-least-once redelivery becomes a no-op (Plan 01-03) |
| fakeredis>=2.25 for publisher unit tests | v2.35 supports XADD/ZADD/PUBSUB fully; tests run in <1s vs. container bring-up cost; testcontainers reserved for integration (Plan 01-03) |
| feedparser isolated to `connectors/rss.py` via Pitfall 9 grep test | Downstream modules only see `SignalEvent`, never `FeedParserDict` — enforced by a unit test that walks src/ (Plan 01-03) |
| URL-prefix guard on synthesized feedparser links | feedparser fills `link` from guid for malformed items; guarding with `startswith(http/https)` and falling back to feed_url keeps `Provenance.source_url` validating (Plan 01-03) |
| APScheduler `max_instances=1 + coalesce=True` per source | Overlapping 60s fetches coalesce into one, preventing Redis dedupe thrash on slow feeds (Plan 01-03) |
| Seed canonical RSS source via migration 0003 (not operator-managed) | `docker compose up` produces visible signal flow on first boot; migration `ON CONFLICT DO NOTHING` keeps re-runs idempotent (Plan 01-03) |
| `sse-starlette` (not `fastapi.sse`) for SSE response class | Pinned FastAPI 0.129.x has not yet vendored `fastapi.sse`; sse-starlette is the upstream lib with identical `EventSourceResponse` + `ServerSentEvent` API (Plan 01-04) |
| Composite `(ingested_at, id)` keyset cursor for `/api/signals` | Avoids OFFSET drift on a hot write path; next_cursor format `"<iso>|<id>"` is opaque to the client (Plan 01-04) |
| Bounded `pubsub.get_message(timeout=1.0)` in SSE live loop | Lets `request.is_disconnected()` fire each iteration — `pubsub.listen()` would block forever and bypass the disconnect check (Pitfall 3, Plan 01-04) |
| Last-Event-ID replay caps at 500 rows | Protects the endpoint from reconnect-storm amplification; anchor-row lookup then forward pagination in `(ingested_at, id)` (Plan 01-04) |
| Source health `status` derivation server-side (`_derive_status`) | Frontend only renders the badge; changing the healthy/degraded/failed policy never requires a frontend deploy (Plan 01-04) |
| Load generator embeds ms-precision timestamp in `source_item_id` | Reruns within the 24h DEDUPE_TTL_S window still produce unique ids, so the generator actually generates load (Plan 01-04) |
| Next.js hand-authored scaffold (no create-next-app) | Executor has no TTY; hand-authoring pins exact versions (Plan 01-05) |
| Tailwind 4.1.11 (not 4.0.0) | Next 16.2 Turbopack PostCSS scanner requires 4.1+ (schema changed between 4.0 and 4.1) (Plan 01-05) |
| @playwright/test 1.51.1 | Next 16.2.4 declares `peerOptional @playwright/test ^1.51.1`; plan's 1.49.1 blocked install (Plan 01-05) |
| ESLint flat config + custom `eslint` lint script | Next 16 dropped `next lint` CLI; migrated to flat `eslint.config.mjs` spreading eslint-config-next entries (Plan 01-05) |
| `typedRoutes` at top-level (not experimental) | Next 16 promoted it out of experimental; old `experimental.typedRoutes` key warns on build (Plan 01-05) |
| Pause-stream UX via frozen React ref | Visible list captured when isPaused flips true; SSE cache keeps growing; resume flushes backlog without EventSource restart (Plan 01-05, D-03) |
| Wire types mirrored ONCE in web/src/lib/schema.ts via zod | `UserOut.id: z.number()` (backend BIGINT→JSON number); every hook *.parse()es payloads so drift blows up at parse time (Plan 01-05) |
| SESSION_COOKIE = 'osint_session' const in middleware.ts | Backend `Settings.cookie_name` literal; drift = silent auth loop, so it lives in one named const (Plan 01-05) |
| Route groups for auth gating: (dashboard)/ | Middleware is cheap cookie-presence heuristic; (dashboard)/layout.tsx calls /api/auth/me and is authoritative (Plan 01-05) |

### Open Todos

- None (roadmap just created)

### Blockers

- None

### Open Questions (from research)

1. Deployment target — single VPS vs Fly.io vs existing cloud? (Phase 0/1 scaffolding impact only)
2. Observability stack — Prometheus+Grafana+Sentry or existing tooling?
3. GDPR jurisdiction — EU-facing? If yes, formal DPIA required before Phase 1.
4. Twitter/X third-party provider — re-verify at Phase 3 implementation time.

## Session Continuity

**Last action:** Completed 01-05-PLAN.md — Next.js 16.2 dashboard vertical slice. Hand-authored scaffold (package.json, next.config.ts, tsconfig, globals.css, layout.tsx, providers.tsx), auth gate (middleware.ts on `osint_session`, (dashboard)/layout useMe), login (D-05 email/password form → /api/auth/login), feed (experimental_streamedQuery SSE hook, @tanstack/react-virtual useVirtualizer + measureElement, compact color-coded D-02 card, frozen-ref pause), item detail (vaul Drawer with target=_blank rel=noopener noreferrer, absolute timestamps), source health sidebar (10s-polled /api/sources/health with emerald/amber/rose badges), Playwright E2E smoke test, docker-compose web service swap. DASH-01..04 + AUTH-01/02 closed.

**Next action:** Phase 01 is complete. Run `/gsd:verify-phase 01` to verify goals and requirement traceability before transitioning to Phase 02 (Breadth + Search).

**Files of record:**

- `.planning/PROJECT.md` — project vision + constraints
- `.planning/REQUIREMENTS.md` — 25 v1 requirements with phase traceability
- `.planning/ROADMAP.md` — 3-phase structure with goal-backward success criteria
- `.planning/research/SUMMARY.md` — stack, architecture, pitfalls research
- `.planning/config.json` — granularity (coarse), mode (yolo), parallelization (on)
- `.planning/phases/01-vertical-slice-rss-end-to-end/01-01-SUMMARY.md` — Plan 01-01 summary
- `.planning/phases/01-vertical-slice-rss-end-to-end/01-02-SUMMARY.md` — Plan 01-02 summary
- `.planning/phases/01-vertical-slice-rss-end-to-end/01-03-SUMMARY.md` — Plan 01-03 summary
- `.planning/phases/01-vertical-slice-rss-end-to-end/01-04-SUMMARY.md` — Plan 01-04 summary
- `.planning/phases/01-vertical-slice-rss-end-to-end/01-05-SUMMARY.md` — Plan 01-05 summary

---
*State initialized: 2026-04-21; Plan 01-01 completed 2026-04-20; Plan 01-02 completed 2026-04-20; Plan 01-03 completed 2026-04-20; Plan 01-04 completed 2026-04-20; Plan 01-05 completed 2026-04-20*
