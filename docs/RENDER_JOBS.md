# Render jobs (no Redis)

This repo uses a **Postgres-backed job queue** for background work (no Redis required).

## What runs where

### 1) Web service (apps/backend)
- Runs the API server.
- Command:
  - `cd apps/backend && npm run start`

### 2) Cron job (scheduler)
- Runs every 5 minutes.
- Enqueues work into Postgres (does not do heavy scoring inline).
- Command:
  - `cd apps/backend && npm run job:scheduler`

### 3) Worker service (executor)
- Runs continuously.
- Pulls jobs from Postgres using `FOR UPDATE SKIP LOCKED`.
- Command:
  - `cd apps/backend && npm run job:worker`

## Required environment variables

Set these on **both** the Cron Job and Worker Service:

- `DATABASE_URL` (runtime DB URL)
- `DIRECT_URL` (direct DB URL; required by Prisma schema)
- `THE_SPORTS_DB_API_KEY` (TheSportsDB key)

Optional:
- `JOBS_MAX_MATCHES` (default: 50)
- `JOBS_LOOKBACK_HOURS` (default: 10)
- `JOBS_LOOKAHEAD_MIN` (default: 60)
- `JOBS_POLL_MS` (default: 750)

## Notes

- Scoring is idempotent:
  - Points are inserted with `INSERT ... ON CONFLICT DO NOTHING RETURNING ...`
  - GroupMember points are only incremented for newly inserted events.
- If you scale to multiple worker instances, the queue claim logic prevents the same job being processed twice.
