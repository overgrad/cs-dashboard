# CS Dashboard

Customer success health dashboard for Overgrad. Pulls accounts, deals, notes and tickets from HubSpot and Freshdesk, scores account health, and sends Slack alerts. Next.js + Prisma (Postgres), deployed on **Heroku** — not Vercel.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign-in is Google OAuth restricted to `@overgrad.com` accounts.

## Deployment (Heroku)

- App: `overgrad-cs-dashboard` (team `overgrad-pipeline`), served at https://cs.overgrad.com.
- Deploy from `main` after a PR is merged:

  ```bash
  git push https://git.heroku.com/overgrad-cs-dashboard.git HEAD:main
  ```

- The `release` phase in the [Procfile](Procfile) runs `prisma migrate deploy`. Every change to `prisma/schema.prisma` must ship with a migration.
- Secrets live only in Heroku config vars (`heroku config -a overgrad-cs-dashboard`).

## Scheduled jobs

Heroku Scheduler calls `GET /api/cron/daily` once a day with `Authorization: Bearer $CRON_SECRET`. The route responds `202` immediately and runs HubSpot sync → Freshdesk + notes sync → scoring and alerts in the background; results go to `heroku logs` (grep `cron`). Add `?silent=1` to record alerts without posting to Slack.

Heroku Scheduler only supports every-10-minutes, hourly and daily frequencies, so anything that should run weekly has to be gated by day inside a daily job — the weekly `#customer_success` reminder goes out on the Monday (UTC) run. Heroku's router also cuts HTTP requests off at 30 seconds, which is why the cron runs the sync steps in-process rather than calling the individual `/api/sync/*` endpoints over HTTP.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection (set by Heroku Postgres) |
| `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | NextAuth Google sign-in |
| `NEXT_PUBLIC_APP_URL` | Public base URL, used for links in Slack messages |
| `CRON_SECRET` | Bearer token for `/api/cron/daily` |
| `SYNC_SECRET` | Bearer token for the `/api/sync/*` and `/api/score/run` endpoints |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app token |
| `FRESHDESK_API_KEY`, `FRESHDESK_SUBDOMAIN` | Freshdesk ticket sync |
| `ANTHROPIC_API_KEY` | Ticket/note sentiment (optional; skipped when unset) |
| `SLACK_BOT_TOKEN` | Slack alerts |
| `SLACK_CS_TEAM_CHANNEL` | Channel for team-wide notices (default `#cs-team`) |
| `SLACK_CUSTOMER_SUCCESS_CHANNEL` | Channel for the weekly queue reminder (default: #customer_success's ID) |
| `SLACK_CS_MANAGER_EMAIL` | CS manager copied on escalated alerts |
| `ALERTS_DISABLED` | Comma-separated alert types to stop posting, e.g. `no_product_usage,champion_gone_dark` |

## Product catalog

ARR uses a generated copy of Finance's product catalog. When Finance classifies new products in cashflow-qbo, run `scripts/generate-product-catalog.py` to regenerate it.
