# Feature Landscape

**Domain:** OSINT Monitoring Dashboard (real-time aggregation of social media, news, and technical web sources)
**Researched:** 2026-04-21
**Overall confidence:** MEDIUM (ecosystem is well-documented via WebSearch; no library-specific Context7 verification needed for feature categorization)

## Executive Overview

OSINT monitoring dashboards exist on a spectrum from hobbyist open-source tools (SMAT, World Monitor, SpiderFoot) to enterprise investigation suites (Maltego, ShadowDragon, Recorded Future, Palantir Gotham, Liferaft, SL Crimewall). Across this spectrum, a consistent set of "table stakes" features has emerged — miss them and analysts abandon the tool. A smaller set of differentiators separates enterprise-grade products from commodity dashboards.

Critically, the domain is **dominated by one failure mode: alert fatigue and information overload**. Industry data shows security teams receive ~960 alerts/day and ignore 23-50%+ of them; 70% of SOC analysts leave within three years citing alert overload. This shapes both the feature set (smart aggregation, suppression, role-based views) and the anti-features (every-event-is-an-alert, one-dashboard-for-everyone).

For GSD Shot Dashboard (v1, public sources, 100+ sources, 1000+ data points/min), the MVP should focus on **signal-over-noise** primitives rather than trying to match enterprise feature counts.

---

## Table Stakes

Features users expect. Missing = product feels broken or users abandon it within the first session.

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| T1 | **Unified real-time feed** across all configured sources | Core value prop; a dashboard without a live feed is just a link list | Medium | Merge + timestamp-order + de-dup items from N sources; sub-5s latency per PROJECT.md |
| T2 | **Per-source connectors** (Twitter/X, Reddit, Telegram, RSS/news, paste sites) | These are the named requirements in PROJECT.md; expected from every OSINT tool | High | Each API has its own auth, rate limits, schemas. X and Telegram are notoriously volatile |
| T3 | **Keyword / boolean search across all ingested items** | Universal expectation; present in Liferaft, SMAT, ShadowDragon, Maltego Monitor, Social Searcher | Medium | Full-text index; AND/OR/NOT; phrase matching |
| T4 | **Filtering by source, time range, keyword, author** | Every reviewed tool offers this; analysts cannot work without it | Low-Medium | UI chips/facets + query DSL |
| T5 | **Configurable alerts / notifications** (keyword match, source spike, saved query hit) | Named in PROJECT.md; universal across reviewed products | Medium | In-app toasts + optional email/webhook; rate-limit notifications to prevent fatigue |
| T6 | **Source health / status indicators** | Named in PROJECT.md; present in every production-grade dashboard (ShadowDragon, Liferaft, World Monitor) | Low | Last-fetch timestamp, error counts, throughput per source |
| T7 | **Item detail view** with original link, author, timestamp, raw content | Analysts must verify in-source; a dashboard that doesn't link back loses trust | Low | Simple drawer/modal; preserve source URL |
| T8 | **Saved searches / watchlists** | Present in Dark Owl Vision UI, Liferaft Navigator, Recorded Future, Maltego Monitor | Medium | Persist query + optional alert binding |
| T9 | **Timeline / chronological visualization** | SMAT, Maltego, Liferaft all lead with this; intel value is inherently temporal | Medium | Event stream sorted by ingest or source timestamp |
| T10 | **Pagination / virtualized scrolling for high-volume feeds** | At 1000+ items/min, naive rendering kills the tab | Medium | Virtual list; "pause stream" affordance |
| T11 | **Authentication and basic access control** | Even single-tenant tools gate access; analysts share screens | Low-Medium | At minimum, local login; no per-target credentials stored (per PROJECT.md constraint) |
| T12 | **Dark mode / low-light UI** | SOC/analyst workflow norm; every reviewed dashboard ships it | Low | CSS-level; often default |

### Table Stakes Dependencies

```
T2 (connectors) → T1 (unified feed) → T9 (timeline)
T1 → T3 (search) → T4 (filtering) → T8 (saved searches) → T5 (alerts)
T1 → T10 (virtualization)
T2 → T6 (source health)
```

**Build order implication:** You cannot ship a useful MVP without T1, T2 (at least 2-3 sources), T3, T4, T6, T7. Everything else can be progressively layered.

---

## Differentiators

Features that elevate the product from "yet another feed reader" to "the tool analysts choose." Not required for MVP, but high-leverage for v2+.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **Cross-source entity correlation** (same URL, username, hash, domain seen across sources) | Connects dots manually impossible at 1000/min; this is Maltego's signature and ShadowDragon's flagship | High | Normalize entities on ingest; link graph; UI to pivot |
| D2 | **Sentiment / tone classification on items** | Maltego Monitor, Sintelix Global Eye, Media Sonar all ship this; helps triage social chatter | Medium-High | LLM or classic classifier; cache results |
| D3 | **Deduplication and near-duplicate clustering** (same story from 20 outlets = 1 card) | Single biggest lever against information overload; missing from most free tools | Medium | MinHash/SimHash; shingling; confidence threshold |
| D4 | **Geospatial view** (events on a map) | World Monitor, Liferaft, Sintelix all lead with maps; analysts with location-sensitive missions need it | High | Geocoding pipeline; map library; clustering markers |
| D5 | **Source spike / anomaly detection** (topic volume 5x baseline = auto-alert) | Turns the dashboard from reactive to proactive; Recorded Future and Dataminr are sold on this | Medium-High | Rolling baselines per topic/source |
| D6 | **Role-based / customizable dashboard layouts** | Directly addresses the #1 dashboard anti-pattern (one-size-fits-all); analyst vs. lead vs. exec views | Medium | Layout persistence; widget library |
| D7 | **In-line enrichment** (WHOIS on domains, archive.org snapshot, link preview) | Cuts context-switching — the biggest source of analyst fatigue per 2026 SOC research | Medium-High | Async enrichers; graceful degradation |
| D8 | **Export / reporting** (CSV, JSON, PDF brief, STIX for threat intel) | Required for any team handing findings upstream; present in Wiz, Maltego, ShadowDragon | Medium | Templated reports; async generation |
| D9 | **Collaboration / annotations** (tag items, leave notes, share a view URL) | SL Crimewall and Liferaft emphasize this; unlocks team workflows | Medium | Per-item notes, tags, shareable permalinks |
| D10 | **API access** for programmatic query / alert subscription | Expected once product matures; integration surface for SIEMs and webhooks | Medium | REST + webhooks; token auth |
| D11 | **AI-powered summarization** of a cluster or time window ("what happened in /r/cybersecurity in the last hour?") | Emerging 2026 norm (Maltego AI, ShadowDragon AI); powerful signal-over-noise lever | Medium | LLM call on clustered items; cache results |
| D12 | **Historical replay / time-scrubbing** (rewind the dashboard to a past moment) | Differentiator because most free tools only show "now"; World Monitor and Gotham both do it | High | Requires solid storage schema; conflicts with 30-day retention cap (PROJECT.md) — scope carefully |

### Differentiator Dependencies

```
T1 → D3 (dedup) → D11 (summarization)
T1 → D5 (anomaly) needs baseline history
T2 → D1 (entity correlation) needs normalized entities
D1 → D4 (geo) if entities include locations
T5 → D5 (smarter alerts)
```

---

## Anti-Features

Features to deliberately NOT build for v1. Each is grounded in either PROJECT.md scope, domain pitfalls, or the alert-fatigue research.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|----|------------|-----------|---------------------|
| A1 | **Dark web / Tor crawling** | Explicit Out of Scope in PROJECT.md; legal/compliance risk; operational burden of Tor infra | Stay on publicly accessible APIs; note it as a future integration point for Intelligence X / Dark Owl if ever expanded |
| A2 | **Automated response / takedown / counter-action workflows** | Explicit Out of Scope in PROJECT.md; v1 is monitoring only; building response widens attack surface and audit requirements | Surface a "copy as report" action; let SOAR/ticket tools handle response |
| A3 | **Mobile native app** | Explicit Out of Scope in PROJECT.md (web-first for v1) | Ensure the web UI is responsive; defer native apps |
| A4 | **Indefinite historical archival** | Explicit Out of Scope in PROJECT.md (>30 days); storage cost + compliance exposure | Hard TTL on stored items; summaries/counts can persist longer than raw content |
| A5 | **Per-target credential storage** (logging into monitored accounts) | PROJECT.md constraint: read-only public collection; credential vaults are a huge liability | Use public endpoints and unauthenticated scraping only; for APIs requiring keys, store only *our* platform keys, not target keys |
| A6 | **Every-event-is-an-alert** firehose | Primary cause of SOC alert fatigue per 2026 research; 70% analyst turnover driver | Alerts gated by explicit saved searches or anomaly thresholds; sensible default suppression |
| A7 | **One-dashboard-for-everyone** kitchen sink | #1 dashboard anti-pattern in 2026 UX research | Start with one focused analyst view; add role-based views as D6 differentiator later |
| A8 | **Raw-log dumping UI** (SIEM-style log tail as primary surface) | "Technical depth over cognitive clarity" anti-pattern; buries signal | Curated cards with summary + expandable detail |
| A9 | **Heavy graph/link-analysis canvas (Maltego-style)** in v1 | Enormous scope; Maltego does this well already; competing is a distraction | If entity correlation is built (D1), keep the UI list/filter-based in v1; graph canvas is v2+ |
| A10 | **Sentiment / classification shown as authoritative truth** | Classifiers are noisy; false confidence misleads analysts | Show classifier output with confidence score; always link to raw content |
| A11 | **Deepfake / image-forensics tooling** | Separate problem domain; mature vendors (HyperVerge, InVID, WeVerify) exist | Link out to those tools from an item detail view |
| A12 | **Ingesting private / paywalled / authenticated-only sources** | PROJECT.md: publicly available APIs and feeds only | Document source selection criteria; reject PRs adding private sources |

---

## MVP Recommendation

Given PROJECT.md's active requirements and the 5s latency / 100 sources / 1000 items/min constraints, the v1 scope should be tightly focused:

### Must-have for MVP (Phase 1)

1. **T2 - Connectors (minimum viable set):** 1 social (Reddit, simplest public API), 1 news (RSS), 1 technical (paste site via RSS or public API). Defer X (API cost/volatility) and Telegram (operational complexity) to Phase 2.
2. **T1 - Unified real-time feed** with sub-5s end-to-end latency.
3. **T3 + T4 - Search and filtering** (keyword, source, time range).
4. **T6 - Source health indicators.**
5. **T7 - Item detail with outbound link.**
6. **T10 - Virtualized feed rendering** — non-negotiable at target volumes.
7. **T11 - Minimal auth** (single-user local login acceptable for v1).

### Must-have for Phase 2 (closes PROJECT.md "Active" requirements)

8. **T2 continued - Twitter/X and Telegram connectors.**
9. **T5 - Configurable alerts** (bound to saved searches — T8).
10. **T8 - Saved searches / watchlists.**
11. **T9 - Timeline visualization.**

### First differentiator to layer (Phase 3)

12. **D3 - Deduplication / near-duplicate clustering** — highest leverage against information overload, enabling everything else to scale.

### Explicitly defer

- D1 (entity correlation), D4 (geospatial), D6 (role-based layouts), D11 (AI summarization), D12 (time-scrubbing) — all high-value but not required for v1 validation.
- Everything in Anti-Features.

### Rationale

The PROJECT.md Core Value is "real-time aggregation of disparate web intelligence sources into a single, actionable dashboard view." The MVP must prove this hypothesis with the smallest feature set that produces a *useful* aggregated feed. Everything after dedup (D3) is gravy until real users validate the core loop.

---

## Sources

- [World Monitor Review 2026 - KuchBhi](https://www.kuchbhi.com/technology/world-monitor-review-2026.html)
- [Best OSINT Tools for Intelligence Gathering (2026) - ShadowDragon](https://shadowdragon.io/blog/best-osint-tools/)
- [Top 10 OSINT Tools for 2026 - Social Links Blog](https://blog.sociallinks.io/top-10-osint-tools-products-solutions-and-software-for-2026/)
- [The Top 10 OSINT Software Tools in 2026 - Cybersecurity News](https://cybersecuritynews.com/the-top-10-osint-software-tools-in-2026/)
- [OSINT Tools For Security Analysts In 2026 - Liferaft Labs](https://liferaftlabs.com/blog/osint-tools-for-security-analysts-in-2026)
- [5 Best OSINT Tools in 2026 - Black Dot Solutions](https://blackdotsolutions.com/blog/best-osint-tools)
- [9 Top OSINT Tools & How to Evaluate Them - Wiz](https://www.wiz.io/academy/threat-intel/osint-tools)
- [Maltego OSINT Platform](https://www.maltego.com/)
- [Maltego Monitor](https://www.maltego.com/monitor/)
- [Top 15 Free OSINT Tools - Recorded Future](https://www.recordedfuture.com/threat-intelligence-101/tools-and-technologies/osint-tools)
- [Social-Media-OSINT-Tools-Collection - GitHub](https://github.com/osintambition/Social-Media-OSINT-Tools-Collection)
- [awesome-osint - GitHub](https://github.com/jivoi/awesome-osint)
- [Telegram-OSINT - GitHub](https://github.com/The-Osint-Toolbox/Telegram-OSINT)
- [Monitoring Social Media with OSINT Tools - Liferaft](https://liferaftlabs.com/blog/7-best-osint-tools-for-social-media)
- [7 Best Reddit OSINT Tools - Liferaft](https://liferaftlabs.com/blog/the-7-best-reddit-osint-software-tools)
- [Alert Fatigue in Security Operations Centres - ACM Computing Surveys](https://dl.acm.org/doi/10.1145/3723158)
- [Alert fatigue and dashboard overload - Medium Bootcamp](https://medium.com/design-bootcamp/alert-fatigue-and-dashboard-overload-why-cybersecurity-needs-better-ux-1f3bd32ad81c)
- [The Cybersecurity Alert Fatigue Epidemic - DataBahn](https://www.databahn.ai/blog/siem-alert-fatigue-false-positive)
- [SOC Alert Fatigue Strategies - Right-Hand](https://right-hand.ai/blog/soc-alert-fatigue/)
- [What Is Alert Fatigue? - IBM](https://www.ibm.com/think/topics/alert-fatigue)
- [Best OSINT Tools - Sintelix](https://sintelix.com/best-osint-tools/)

**Confidence breakdown:**
- Table stakes list: **HIGH** — every item appears in 3+ independently reviewed products
- Differentiators list: **MEDIUM-HIGH** — each feature is attested by named products but priority ordering is opinionated
- Anti-features: **HIGH** — grounded in either explicit PROJECT.md scope or well-documented 2026 SOC research on alert fatigue
- Complexity estimates: **MEDIUM** — based on typical implementation patterns; will sharpen during phase planning
