# OSINT Shot Dashboard

A real-time OSINT monitoring dashboard that aggregates and visualizes web intelligence from social media, news, and technical sources into a single unified interface.

## Quickstart

1. `bash scripts/smoke_env.sh` — verify docker, node, python, and uv are installed
2. `cp .env.example .env` — create environment file (edit `SESSION_SECRET` for non-local use)
3. `docker compose up -d db redis` — start TimescaleDB and Redis
4. `cd backend && uv sync && uv run alembic upgrade head` — install deps and apply migrations
5. `docker compose up -d` — start the full stack (caddy, backend, web)
6. Visit `http://localhost:8080`

## Services

| Service | URL | Purpose |
|---------|-----|---------|
| db | localhost:5432 | TimescaleDB (Postgres 17 + Timescale 2.17) — signals hypertable |
| redis | localhost:6379 | Redis 7.4 — Streams + Pub/Sub for the ingestion pipeline |
| caddy | http://localhost:8080 | Reverse proxy — unified origin for `/api` → backend and `/` → web |
| backend | :8000 (internal) | FastAPI backend — direct access discouraged (cookie-scope) |
| web | :3000 (internal) | Next.js dashboard — direct access discouraged (cookie-scope) |

## Create first user

Run once after migrations:

```bash
docker compose exec backend python -m src.cli.create_user --email analyst@local --password changeme
```

Or locally:

```bash
cd backend && uv run python -m src.cli.create_user --email analyst@local --password changeme
```

## Development notes

- All browser requests should go through `http://localhost:8080` (Caddy) to match production cookie/SSE behavior. Direct :3000 / :8000 access will cause cookie-scope issues (Pitfall 8).
- SSE long-lived connections are configured with 24h read/write timeouts and `flush_interval -1` on the Caddy reverse proxy (closes Pitfall 12).
- Both `DATABASE_URL` (asyncpg, for FastAPI runtime) and `DATABASE_URL_SYNC` (psycopg, for Alembic) are required — Alembic runs synchronously.

## Frontend

Next.js 16.2 dashboard (App Router, React 19, Tailwind 4, TanStack Query, shadcn/ui). Dark mode is the default theme.

- Dev via Compose: `docker compose up -d` — Next starts on `:3000`, reach it through Caddy at `http://localhost:8080`.
- Local-only dev: `cd web && npm install && npm run dev` (then visit http://localhost:3000; note: cookie-scoped APIs still want Caddy on :8080).
- Type check: `cd web && npm run typecheck`
- Lint: `cd web && npm run lint`
- Build: `cd web && npm run build`
- E2E: `cd web && npx playwright install chromium && npm run test:e2e`

Seed a user first so you can actually log in:

```bash
docker compose exec backend uv run python -m src.cli.create_user --email analyst@example.com --password hunter2hunter2
```

## Load testing

Prove the pipeline holds at 1000 items/min (success criterion 3 / Pitfall 10 guard):

```bash
cd backend
uv run python ../scripts/load_generator.py --rate 1000 --duration 60
docker compose exec db psql -U osint -d osint \
    -c "SELECT count(*) FROM signals WHERE source_id='loadgen:synth';"
# Expect ~1000 rows after 60 seconds.
```

While the generator runs, `curl -N -b cookies.txt http://localhost:8080/api/stream`
(or the browser SPA) should continuously receive `event: signal` frames without
drops. Use `--rate` / `--duration` / `--source-id` to tune runs.

## E2E testing

Prereqs: `docker compose up -d` ready, a user seeded via
`docker compose exec backend uv run python -m src.cli.create_user --email analyst@example.com --password hunter2hunter2`.

Run:

```bash
# 1. Prime one synthetic signal so the feed has something to show
docker compose exec backend uv run python scripts/load_generator.py \
  --rate 1 --duration 5 --source-id rss:e2e &

# 2. Run the Playwright test
cd web
npx playwright install chromium
E2E_EMAIL=analyst@example.com E2E_PASSWORD=hunter2hunter2 npm run test:e2e
```
