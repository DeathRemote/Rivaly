# Vercel Cron — Match sync job

Rivaly exposes a job endpoint:

- `POST /api/jobs/matches/sync`

## Security

Set an env var:

- `JOB_SECRET`

The endpoint accepts either:
- header: `x-job-secret: <JOB_SECRET>`
- query param: `?token=<JOB_SECRET>`

## Vercel Cron setup

Vercel Cron **does not support custom request headers** from `vercel.json`.
So we configure the cron job in the **Vercel Dashboard** using a URL with a token query param.

### Steps

1. In Vercel → your Project → **Settings** → **Environment Variables**
   - Add `JOB_SECRET` (same value in Production/Preview as you prefer)

2. In Vercel → your Project → **Cron Jobs**
   - Create a new cron job:
     - **Schedule:** `*/5 * * * *`
     - **Method:** `POST`
     - **URL:** `https://<your-domain>/api/jobs/matches/sync?token=<JOB_SECRET>`

> Note: you must paste the actual secret into the URL. Vercel Cron paths do not support env interpolation.

## Local testing

PowerShell:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/jobs/matches/sync?token=$env:JOB_SECRET"
```

Or with header (manual/admin calls):

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/jobs/matches/sync" `
  -Headers @{ "x-job-secret" = $env:JOB_SECRET }
```
