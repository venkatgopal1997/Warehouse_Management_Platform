# Deployment Guide — Push to Google Cloud & Get Public URL

## Prerequisites

1. A Google account
2. Google Cloud account with billing enabled (new accounts get **$300 free credit**)
3. `gcloud` CLI installed on your machine

---

## Step 0: Install Google Cloud CLI

Download and install from: https://cloud.google.com/sdk/docs/install

After install, open terminal and run:
```bash
gcloud init
gcloud auth login
```

This will open browser → sign in with Google account → authorize.

---

## Step 1: Create a GCP Project

```bash
# Create a new project (pick a unique ID)
gcloud projects create warehouse-wms-app --name="Warehouse Management"

# Set it as active project
gcloud config set project warehouse-wms-app

# Enable billing (required — but free credit covers everything)
# Go to: https://console.cloud.google.com/billing
# Link your project to a billing account
```

---

## Step 2: Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable bigquery.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

---

## Step 3: Create Cloud SQL (PostgreSQL) Instance

```bash
# Create a small PostgreSQL instance (cheapest tier)
gcloud sql instances create wms-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-south1 \
  --root-password=YOUR_DB_PASSWORD

# Create a database
gcloud sql databases create warehouse_db --instance=wms-db

# Create a user
gcloud sql users create wms_user \
  --instance=wms-db \
  --password=YOUR_USER_PASSWORD
```

**Note your connection name:**
```bash
gcloud sql instances describe wms-db --format="value(connectionName)"
# Output: warehouse-wms-app:asia-south1:wms-db
```

---

## Step 4: Update Prisma Schema for PostgreSQL

Change `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"       ← change from "sqlite" to "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Step 5: Push Schema & Seed to Cloud SQL

You need to connect to Cloud SQL from your local machine:

```bash
# Install Cloud SQL Auth Proxy
# Download from: https://cloud.google.com/sql/docs/postgres/sql-proxy

# Run the proxy (keeps running in background)
cloud-sql-proxy warehouse-wms-app:asia-south1:wms-db --port=5432

# In another terminal, set DATABASE_URL
set DATABASE_URL=postgresql://wms_user:YOUR_USER_PASSWORD@localhost:5432/warehouse_db

# Push tables to Cloud SQL
npx prisma db push

# Seed the database
npm run db:seed
```

---

## Step 6: Create BigQuery Dataset

```bash
# Create dataset
bq mk --location=asia-south1 warehouse_analytics
```

---

## Step 7: Set Up Secrets in Secret Manager

```bash
# Store secrets (never put these in code)
echo -n "postgresql://wms_user:YOUR_USER_PASSWORD@/warehouse_db?host=/cloudsql/warehouse-wms-app:asia-south1:wms-db" | \
  gcloud secrets create database-url --data-file=-

echo -n "sk_test_YOUR_WORKOS_KEY" | \
  gcloud secrets create workos-api-key --data-file=-

echo -n "client_YOUR_WORKOS_CLIENT" | \
  gcloud secrets create workos-client-id --data-file=-
```

---

## Step 8: Build & Deploy to Cloud Run (GET PUBLIC URL)

```bash
# Build the Docker image using Cloud Build
gcloud builds submit --tag gcr.io/warehouse-wms-app/warehouse-app

# Deploy to Cloud Run
gcloud run deploy warehouse-app \
  --image gcr.io/warehouse-wms-app/warehouse-app \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --add-cloudsql-instances warehouse-wms-app:asia-south1:wms-db \
  --set-env-vars "DATABASE_URL=postgresql://wms_user:YOUR_USER_PASSWORD@/warehouse_db?host=/cloudsql/warehouse-wms-app:asia-south1:wms-db" \
  --set-env-vars "NEXT_PUBLIC_APP_URL=https://warehouse-app-XXXXX-el.a.run.app" \
  --set-env-vars "WORKOS_API_KEY=sk_test_YOUR_KEY" \
  --set-env-vars "WORKOS_CLIENT_ID=client_YOUR_ID" \
  --set-env-vars "WORKOS_REDIRECT_URI=https://warehouse-app-XXXXX-el.a.run.app/api/auth/callback" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=warehouse-wms-app" \
  --set-env-vars "BIGQUERY_DATASET=warehouse_analytics" \
  --set-env-vars "ALLOW_DEV_LOGIN=true"
```

**After this command, you get your PUBLIC URL:**
```
Service URL: https://warehouse-app-abc123-el.a.run.app    ← THIS IS YOUR PUBLIC URL
```

---

## Step 9: Run BigQuery Sync

```bash
# With Cloud SQL proxy still running locally:
set DATABASE_URL=postgresql://wms_user:YOUR_USER_PASSWORD@localhost:5432/warehouse_db
set GOOGLE_CLOUD_PROJECT=warehouse-wms-app
set BIGQUERY_DATASET=warehouse_analytics

npm run sync:bigquery
```

---

## Step 10: Verify Everything Works

1. Open your public URL: `https://warehouse-app-XXXXX-el.a.run.app`
2. Use dev login with `admin@coastal.test`
3. Check dashboard, warehouses, inventory, movements
4. Check analytics page (should show BigQuery charts)

---

## Quick Summary (The Minimum Commands)

```bash
# 1. Login
gcloud auth login
gcloud config set project warehouse-wms-app

# 2. Enable APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com sqladmin.googleapis.com bigquery.googleapis.com

# 3. Create database
gcloud sql instances create wms-db --database-version=POSTGRES_15 --tier=db-f1-micro --region=asia-south1 --root-password=MyPassword123

# 4. Build & push docker image
gcloud builds submit --tag gcr.io/warehouse-wms-app/warehouse-app

# 5. Deploy (GET PUBLIC URL)
gcloud run deploy warehouse-app --image gcr.io/warehouse-wms-app/warehouse-app --platform managed --region asia-south1 --allow-unauthenticated --add-cloudsql-instances warehouse-wms-app:asia-south1:wms-db --set-env-vars "DATABASE_URL=postgresql://..."

# 6. Done! Your URL: https://warehouse-app-XXXXX-el.a.run.app
```

---

## Cost

| Service | Cost |
|---------|------|
| Cloud SQL (db-f1-micro) | ~$7/month (free credit covers it) |
| Cloud Run | Free tier (2M requests/month free) |
| BigQuery | Sandbox tier free (1TB query/month) |
| **Total with $300 free credit** | **$0** |

**Tear it down after evaluation:**
```bash
gcloud projects delete warehouse-wms-app
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Permission denied" | Run `gcloud auth login` again |
| Cloud Build fails | Make sure Dockerfile is in project root |
| Can't connect to Cloud SQL | Check Cloud SQL proxy is running, password is correct |
| App deploys but shows error | Check logs: `gcloud run services logs read warehouse-app` |
| BigQuery queries fail | Make sure service account has BigQuery access |
| 502 Bad Gateway | App is crashing — check: `gcloud run services logs read warehouse-app --region asia-south1` |
