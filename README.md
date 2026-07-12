# Warehouse Management Platform

A multi-tenant warehouse management system with authentication, role-based access control, and analytics powered by a Postgres → BigQuery pipeline.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) · React 19 · TypeScript strict |
| Transactional DB | Cloud SQL for PostgreSQL via Prisma |
| Analytics DB | BigQuery |
| Auth | WorkOS AuthKit |
| Styling | Tailwind CSS |
| Grid & Charts | AG Grid Community + Recharts |
| Deploy | Cloud Run (Docker) |
| Secrets | Google Secret Manager |

> **Production swap note:** In production, I'd swap AG Grid Community for AG Grid Enterprise (row grouping, server-side row model) and Recharts for Tremor or Apache ECharts for richer visualization.

---

## Architecture

```
Next.js App  →  Postgres (Cloud SQL)  →  Sync  →  BigQuery  →  Dashboard Charts
  (CRUD)         (Transactional)       (Batch)    (Analytics)    (Read-only)
```

### Sync Architecture: Scheduled Batch (Cloud Scheduler + Cloud Run Job)

**Why this approach:**
- **Simplicity:** Single idempotent script, no message queues or CDC infrastructure
- **Durability:** WRITE_TRUNCATE on each run — always consistent, self-healing
- **Cost:** One Cloud Run Job invocation every 15 minutes ≈ $0/month at this scale
- **Idempotency:** Running the sync twice produces identical results

**Trade-offs accepted:**
- ~15 min data staleness in analytics (acceptable for dashboards, not for real-time alerts)
- Full table replacement is inefficient at scale (>1M rows would need incremental/CDC)

**Alternatives considered:**
- *Pub/Sub event-driven:* Lower latency but requires change-data-capture tracking, dead-letter handling
- *Datastream (CDC):* Near real-time, but expensive and overkill for <100K rows
- *Dual-write:* Lowest latency but tightly couples transactional and analytical paths

---

## Running Locally

### Prerequisites
- Node.js 20+
- PostgreSQL (or use SQLite for quick start)

### Setup

```bash
# Install dependencies
npm install

# Copy env file and configure
cp .env.example .env

# For SQLite local dev, update .env:
# DATABASE_URL="file:./dev.db"

# Generate Prisma client and push schema
npx prisma generate
npx prisma db push

# Seed the database
npx prisma db seed

# Start dev server
npm run dev
```

### Dev Login
For local development, use the dev login form with any seeded email (no WorkOS needed):

---

## Seeded Test Users

| Organisation | Role | Email |
|---|---|---|
| Coastal Logistics | Admin | admin@coastal.test |
| Coastal Logistics | Manager | manager@coastal.test |
| Coastal Logistics | Operator | operator@coastal.test |
| Meridian Stores | Admin | admin@meridian.test |
| Meridian Stores | Manager | manager@meridian.test |
| Meridian Stores | Operator | operator@meridian.test |
| Tilman & Co. | Admin | admin@tilman.test |
| Tilman & Co. | Manager | manager@tilman.test |
| Tilman & Co. | Operator | operator@tilman.test |

---

## RBAC Enforcement

Permissions are enforced at **both the API layer and the data layer** — never just hidden UI buttons.

| Permission | Admin | Manager | Operator |
|---|:---:|:---:|:---:|
| warehouse:create/delete | ✓ | | |
| warehouse:update | ✓ | ✓ | |
| warehouse:read | ✓ | ✓ | ✓ |
| inventory:create/update | ✓ | ✓ | |
| inventory:read | ✓ | ✓ | ✓ |
| movement:create | ✓ | ✓ | ✓ |
| analytics:read | ✓ | ✓ | |
| user:manage | ✓ | | |

**Multi-tenant isolation:** Every query filters by `organisationId` from the session. An org can never see another org's data — enforced at the data layer via Prisma `where` clauses.

---

## Deploying to Google Cloud

```bash
# 1. Build and push Docker image
gcloud builds submit --tag gcr.io/PROJECT_ID/warehouse-app

# 2. Deploy to Cloud Run
gcloud run deploy warehouse-app \
  --image gcr.io/PROJECT_ID/warehouse-app \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=postgresql://..." \
  --set-secrets "WORKOS_API_KEY=workos-api-key:latest"

# 3. Run the BigQuery sync
gcloud run jobs create bq-sync \
  --image gcr.io/PROJECT_ID/warehouse-app \
  --command "node" \
  --args "scripts/sync-to-bigquery.js"

# 4. Schedule the sync (every 15 min)
gcloud scheduler jobs create http bq-sync-schedule \
  --schedule "*/15 * * * *" \
  --uri "https://REGION-run.googleapis.com/..." \
  --http-method POST
```

---

## What I Would Add With More Time

**Proposed feature: Predictive Reorder Alerts**
- Analyze movement velocity from BigQuery to predict when stock will hit zero
- Trigger email/Slack alerts 7 days before estimated stockout
- Simple linear regression on outbound velocity per SKU per warehouse
- Why: Prevents costly stockouts without manual monitoring. Leverages the BQ pipeline already in place.

---

## What I Cut

- User management UI (CRUD users via API exists, no admin panel)
- Real-time WebSocket updates for stock movements
- Comprehensive error boundaries in the UI
- E2E tests (would use Playwright)
- Cloud Run deploy automation (documented above)

---

## Decisions & Assumptions

- **SQLite for local dev:** The brief allows this; Cloud SQL is used in deployment
- **Session as base64 cookie:** Simple for the exercise; production would use signed JWTs or WorkOS session management
- **Dev login route:** Allows reviewers to test without configuring WorkOS locally. Disabled in production unless ALLOW_DEV_LOGIN is set.
- **WRITE_TRUNCATE sync:** Acceptable at this data scale (~400 movements). At 1M+ rows, I'd switch to incremental sync with a `last_synced_at` watermark.
