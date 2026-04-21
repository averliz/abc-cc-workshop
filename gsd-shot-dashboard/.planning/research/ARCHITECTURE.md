# Architecture Patterns

**Domain:** OSINT Monitoring Dashboard (real-time multi-source aggregation)
**Researched:** 2026-04-21
**Overall confidence:** MEDIUM-HIGH

## Executive Summary

OSINT monitoring dashboards converge on a **five-layer streaming architecture**: (1) source connectors, (2) ingestion/normalization, (3) storage + cache, (4) push delivery to clients, and (5) presentation. The dominant pattern in 2026 combines a **pluggable connector framework** (each source is an isolated plugin) with a **message-queue backbone** (Redis Streams, Kafka, or equivalent) feeding a **server-push delivery layer** (Server-Sent Events is preferred for dashboards over WebSockets). This ordering — ingest → normalize → queue → fan-out → render — is driven by the core constraint that one flaky source must not stall the rest of the pipeline.

The build-order implication is strong: start with **one end-to-end vertical slice** (one source → storage → dashboard tile) before broadening source count. Adding sources later is cheap if the connector contract is right; widening a monolithic ingester later is expensive.

---

## Recommended Architecture

### High-Level Diagram

```
+------------------+     +------------------+     +------------------+
| Source Connectors|     |  Normalization   |     |   Event Bus      |
| (RSS, Reddit,    | --> |  & Enrichment    | --> |  (Redis Streams  |
| Twitter, Telegram|     |  (schema, dedupe,|     |   / Kafka)       |
| HN, paste sites) |     |   tags, scoring) |     |                  |
+------------------+     +------------------+     +--------+---------+
      ^ poll/stream                                        |
      |                                                    v
+------------------+                             +------------------+
| Source Registry  |                             |  Persistence     |
| & Health Monitor | <---------------------------+  (Postgres +     |
+------------------+     health/metrics          |   time-series +  |
                                                 |   Redis cache)   |
                                                 +--------+---------+
                                                          |
                                                          v
                                                 +------------------+
                                                 |  Query API +     |
                                                 |  SSE Stream      |
                                                 |  (REST + /stream)|
                                                 +--------+---------+
                                                          |
                                                          v
                                                 +------------------+
                                                 |  Dashboard SPA   |
                                                 |  (filters, tiles,|
                                                 |   alerts, search)|
                                                 +------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Boundary Rule |
|-----------|----------------|-------------------|---------------|
| **Source Connectors** | Pull/subscribe to one external source, emit raw records | Normalization (outbound only) | One connector per source type. Failure is isolated — crash/backoff does not affect peers. |
| **Normalization & Enrichment** | Map raw source payloads to canonical `SignalEvent` schema, dedupe, tag, score | Connectors (in), Event Bus (out) | Pure transform. No external API calls. Deterministic output for a given input. |
| **Event Bus** | Durable, ordered buffer between producers and consumers | Normalization (producer), Persistence + SSE (consumers) | Single source of truth for "what happened." Multiple consumers read independently. |
| **Persistence Layer** | Store signals for query, history (30 days), full-text search | Event Bus (in), Query API (out) | Append-mostly workload. Time-indexed + text-indexed. |
| **Source Registry & Health Monitor** | Track which sources exist, their config, last-success timestamp, error category | All connectors (metrics in), Query API (health out) | Read-heavy; small data volume; separate from signal data. |
| **Query API + SSE Stream** | REST for historical queries + filters; SSE for live push | Persistence (reads), Event Bus (subscribes), Dashboard (serves) | SSE is server-to-client only. All client actions go through REST. |
| **Dashboard SPA** | Render tiles, filters, search, alerts; consume SSE stream | Query API (REST + SSE) | No direct DB or bus access. All data through API. |
| **Alert Engine** | Evaluate user-defined rules against the event stream; emit notifications | Event Bus (subscriber), Notification dispatch (out) | Rule evaluation is stateless per event where possible; rolling-window rules use bounded state. |

### Data Flow

**Write path (per signal):**
1. Connector polls source or receives webhook/stream message
2. Connector emits raw record to Normalization
3. Normalization maps to `SignalEvent { id, source, timestamp, author, content, url, tags, score, geo? }`
4. Deduplicator drops if `hash(url, content)` already seen in last 24h
5. Normalized event published to Event Bus
6. Persistence consumer writes to DB; indexes for time + text
7. SSE consumer fans out to connected clients matching their filter
8. Alert Engine consumer evaluates rules; dispatches notifications on match

**Read path (dashboard load):**
1. Client hits `GET /api/signals?filters=...&since=...` for initial backfill (last N minutes)
2. Client opens `GET /api/stream?filters=...` (SSE) for live updates
3. Server streams new matching events as they pass through the bus
4. On reconnect, SSE `Last-Event-ID` header resumes from last seen event

**Health path:**
1. Each connector writes heartbeat + last-error to Source Registry every 30s
2. Dashboard polls `GET /api/sources/health` for status indicators

---

## Patterns to Follow

### Pattern 1: Connector Contract (Plugin Architecture)

**What:** Every source is a plugin implementing a small, fixed interface. Adding a source = writing one file, not modifying the pipeline.

**When:** From day one. The temptation to hardcode the first source is strong; resist it.

**Example (TypeScript, conceptual):**
```typescript
interface SourceConnector {
  id: string;                    // "reddit", "hn", "rss:bbc"
  schedule: CronExpr | 'stream'; // polling interval or push-mode
  start(emit: (raw: RawRecord) => void): Promise<void>;
  stop(): Promise<void>;
  health(): HealthStatus;
}
```

Inspired by Conduit's gRPC plugin design and Logstash's 200+ plugin model — in-process is fine for v1; the contract matters more than the transport.

### Pattern 2: Canonical Signal Schema

**What:** Every source normalizes to the same `SignalEvent` shape before hitting the bus. Downstream code never sees source-specific fields.

**When:** Always. This is the single most valuable decision in the whole system.

**Example:**
```typescript
type SignalEvent = {
  id: string;              // deterministic hash of (source, source_id)
  source_id: string;       // "reddit", "twitter"
  source_url: string;      // link back to original
  timestamp: number;       // unix ms, source-reported
  ingested_at: number;     // unix ms, our time
  author?: string;
  title?: string;
  content: string;
  tags: string[];          // ["security", "vuln"]
  geo?: { lat: number; lon: number; place?: string };
  score?: number;          // upvotes, followers, etc — normalized 0-1
  raw?: unknown;           // original payload for debugging
};
```

### Pattern 3: SSE for Live Push (not WebSockets)

**What:** Use Server-Sent Events for the dashboard's live stream. The data flow is one-way (server → client) and SSE handles reconnect, resumption, and HTTP/2 multiplexing natively.

**When:** For all live dashboard updates. Only reach for WebSockets if the dashboard later adds bidirectional features (collaborative filters, live command input).

**Example:**
```typescript
// Server
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  const lastId = req.headers['last-event-id'];
  const sub = bus.subscribe({ filters: parseFilters(req), since: lastId });
  sub.on('event', (e) => res.write(`id: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`));
  req.on('close', () => sub.unsubscribe());
});

// Client
const es = new EventSource('/api/stream?tags=security');
es.onmessage = (e) => store.addSignal(JSON.parse(e.data));
// Reconnection + Last-Event-ID resumption are automatic
```

### Pattern 4: Fail-Isolated Connectors

**What:** Each connector runs in its own async task/process with its own retry/backoff. A 429 from Twitter does not slow down Reddit ingestion.

**When:** Always. This is the #1 architectural risk for multi-source systems.

**How:** Separate workers per source, per-source rate limit tracking, exponential backoff with jitter, dead-letter for malformed records, and health heartbeats so the dashboard shows "Twitter: rate-limited, retrying in 120s" instead of silently going stale.

### Pattern 5: Signalling Pattern for Heavy Payloads (optional)

**What:** For large records (embedded media, long threads), SSE sends a lightweight "new event with ID X" notification and the client fetches the full record via cached REST.

**When:** Only if average payload exceeds ~4KB or if HTTP caching would meaningfully reduce bandwidth. For plain text OSINT signals, push full payloads directly.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Ingester

**What:** A single `ingest.ts` that pulls from all sources in one loop.
**Why bad:** One slow/broken source stalls the rest. Adding sources means editing the core. No per-source isolation for retries, rate limits, or health.
**Instead:** Plugin contract from day one. Even with one source, build the registry.

### Anti-Pattern 2: Skipping the Event Bus

**What:** Connector writes directly to the database; dashboard polls the database for new rows.
**Why bad:** Polling adds latency (breaks the 5-second SLA), misses the push-based delivery story, and ties consumers (persistence, alerts, SSE) together — each new consumer needs DB access.
**Instead:** Publish to a bus; let consumers subscribe independently. Redis Streams is sufficient for v1; migrate to Kafka only if volume demands it.

### Anti-Pattern 3: Client-Driven Filtering Only

**What:** Server streams every event; client filters in-browser.
**Why bad:** At 1000+ events/min this melts browser performance and wastes bandwidth. Also leaks data the user shouldn't see.
**Instead:** Server-side filter subscription — client sends filter spec on SSE connect, server only emits matching events.

### Anti-Pattern 4: Storing Raw Source Payloads as the Primary Record

**What:** Treating raw API responses as the canonical data, converting at read time.
**Why bad:** Every source format change requires updating all read-side code. Cross-source queries become impossible.
**Instead:** Normalize at write time. Keep raw in a `raw` field for debugging only.

### Anti-Pattern 5: WebSockets Without a Reason

**What:** Reaching for WebSockets because "real-time" was in the requirements.
**Why bad:** Stateful connections complicate scaling (sticky routing, pub/sub fanout across instances), break HTTP caching, and require engineering auth/reconnect/heartbeats from scratch. Corporate proxies still occasionally block WebSocket upgrades in 2026.
**Instead:** SSE. Revisit only when bidirectional features are actually needed.

---

## Scalability Considerations

| Concern | At 10 sources / 100 events/min | At 100 sources / 1000 events/min (target) | At 500 sources / 10K events/min |
|---------|-------------------------------|------------------------------------------|---------------------------------|
| **Connectors** | Single Node process, all in-process | Split by source type into 2-3 worker processes | Per-source processes or container-per-source |
| **Event Bus** | Redis Streams (single instance) | Redis Streams with consumer groups | Kafka or NATS JetStream |
| **Persistence** | Postgres with time-indexed signals table | Postgres + a dedicated full-text index (pg_trgm or Meilisearch) | Time-series DB (TimescaleDB) + search (OpenSearch) |
| **SSE Fanout** | Single server instance | Horizontal scaling with Redis Pub/Sub as fanout backbone | Dedicated SSE gateway tier |
| **Dashboard** | Direct fetch + SSE | Virtualized lists, throttled re-renders, memoized tiles | Tile-level lazy loading, worker threads for heavy client ops |
| **Dedupe window** | In-memory LRU | Redis SETEX with TTL | Bloom filter + Redis check |

The v1 target (100 sources, 1000 events/min) is comfortably inside a single-host deployment. Architectural decisions should preserve the *option* to scale out (plugin isolation, bus between components) without paying the cost of distributed systems upfront.

---

## Suggested Build Order (Critical for Roadmap)

The dependency graph between components dictates phase ordering:

### Phase 1 — Vertical Slice (end-to-end, 1 source)
Build the full pipeline for **one source** (suggest: RSS, simplest protocol):
1. Connector contract + RSS connector
2. Canonical `SignalEvent` schema + normalizer
3. Minimal event bus (start with in-memory or Redis Streams)
4. Postgres persistence with time index
5. Basic REST `/signals` endpoint
6. SPA shell with one tile showing latest signals
7. SSE stream connecting bus to SPA

**Why this order:** Proves the contract. Every later source just implements the connector interface — the rest of the system stays untouched.

### Phase 2 — Breadth (more sources)
Add connectors one at a time: Reddit, HN, then Twitter/X, then Telegram. Each is one file + tests.

**Dependency:** Phase 1 must exist. No architectural changes needed.

### Phase 3 — Query & Filter
Server-side filtering on SSE, search (full-text), tag-based filters, time ranges.

**Dependency:** Breadth needed first — filtering one source is uninteresting.

### Phase 4 — Health & Observability
Source Registry, health dashboard, per-source metrics, error categorization (auth / rate-limit / parse / network).

**Dependency:** Can be built alongside Phase 2-3 but becomes essential before scaling sources past ~20.

### Phase 5 — Alerting
Rule engine consuming the event bus, notification dispatch (email/webhook), rule CRUD UI.

**Dependency:** Requires stable stream (Phases 1-3) and a reliable bus.

### Phase 6 — Scale Hardening
Only if load demands it: move to Kafka, split connectors into containers, add dedicated search index, SSE gateway tier.

**Dependency:** Measure first. Don't pre-optimize.

---

## Sources

- [Streaming in 2026: SSE vs WebSockets vs RSC - JetBI](https://jetbi.com/blog/streaming-architecture-2026-beyond-websockets)
- [How to Use SSE vs WebSockets for Real-Time Communication - OneUptime](https://oneuptime.com/blog/post/2026-01-27-sse-vs-websockets/view)
- [Server-Sent Events vs WebSockets: Key Differences and Use Cases in 2026 - Nimbleway](https://www.nimbleway.com/blog/server-sent-events-vs-websockets-what-is-the-difference-2026-guide)
- [Conduit Plugin Architecture ADR - ConduitIO/conduit](https://github.com/ConduitIO/conduit/blob/main/docs/architecture-decision-records/20220121-conduit-plugin-architecture.md)
- [Designing a Universal Data Ingestion Layer - Manik Hossain](https://medium.com/@manik.ruet08/designing-a-universal-data-ingestion-layer-from-apis-to-streaming-in-one-framework-826b426b49bb)
- [How Do You Architect a Scalable Activity Feed System? - GetStream](https://getstream.io/blog/scalable-activity-feed-architecture/)
- [Building a Scalable Real-time Data Pipeline for Social Media Analytics - Towards Data Engineering](https://medium.com/towards-data-engineering/building-a-scalable-and-real-time-data-pipeline-for-social-media-analytics-with-apache-kafka-and-e8dd663fbf65)
- [Guidance for Social Media Data Pipeline on AWS](https://aws.amazon.com/solutions/guidance/social-media-data-pipeline-on-aws/)
- [Building Risk Dashboards with OSINT Data - Knowlesys](https://knowlesys.com/en/articles/93/Building_Risk_Dashboards_with_OSINT_Data.html)
- [World Monitor: Free Open-Source Global Intelligence Dashboard - DarkWebInformer](https://darkwebinformer.com/world-monitor-a-free-open-source-global-intelligence-dashboard-with-25-data-layers-and-ai-powered-threat-classification/)
- [Data Ingestion Architecture Guide - Rivery](https://rivery.io/data-learning-center/data-ingestion-architecture-guide/)
- [How To Design A Modern, Robust Data Ingestion Architecture - Monte Carlo](https://www.montecarlodata.com/blog-design-data-ingestion-architecture/)

**Confidence notes:**
- HIGH: SSE-over-WebSockets recommendation for dashboards (multiple 2026 sources agree, matches HTTP/3 trajectory)
- HIGH: Plugin/connector architecture (universal pattern, concrete Conduit/Logstash reference implementations)
- HIGH: Five-layer streaming architecture (convergent pattern across AWS, Kafka+Spark, and OSINT-specific sources)
- MEDIUM: Specific tech choices (Redis Streams vs Kafka) — depends on team familiarity and actual scale
- MEDIUM: Build-order recommendation — based on dependency logic, not benchmarked against alternative orderings
