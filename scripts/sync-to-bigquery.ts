/**
 * Sync script: Postgres → BigQuery
 *
 * Architecture Decision: Cloud Scheduler + Cloud Run Job (scheduled batch sync)
 *
 * Trade-offs:
 * - Latency: ~15 min stale data (acceptable for analytics dashboards)
 * - Durability: Full snapshot on each run — idempotent, recoverable from any failure
 * - Complexity: Single script, no message queues or CDC infra
 * - Cost: Minimal — one Cloud Run Job invocation every 15 min
 *
 * Alternatives considered:
 * - Pub/Sub event-driven: Lower latency but higher complexity, requires change tracking
 * - Datastream (CDC): Near real-time but overkill for this scale, expensive
 * - Dual-write: Lowest latency but couples transactional path to analytics, risk of inconsistency
 *
 * This approach is idempotent: running it twice produces the same result (WRITE_TRUNCATE).
 */

import { BigQuery } from "@google-cloud/bigquery";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const DATASET = process.env.BIGQUERY_DATASET || "warehouse_analytics";

async function ensureDataset() {
  const [datasets] = await bigquery.getDatasets();
  const exists = datasets.some((d) => d.id === DATASET);
  if (!exists) {
    await bigquery.createDataset(DATASET);
    console.log(`Created dataset: ${DATASET}`);
  }
}

async function syncInventorySnapshot() {
  console.log("Syncing inventory snapshot...");

  const items = await prisma.inventoryItem.findMany({
    include: {
      warehouse: {
        include: { organisation: true },
      },
    },
  });

  const rows = items.map((item) => ({
    item_id: item.id,
    sku: item.sku,
    item_name: item.name,
    quantity: item.quantity,
    warehouse_id: item.warehouseId,
    warehouse_name: item.warehouse.name,
    warehouse_location: item.warehouse.location,
    warehouse_capacity: item.warehouse.capacity,
    organisation_id: item.warehouse.organisationId,
    organisation_name: item.warehouse.organisation.name,
    synced_at: new Date().toISOString(),
  }));

  const table = bigquery.dataset(DATASET).table("inventory_snapshot");

  // WRITE_TRUNCATE makes this idempotent — full replacement each sync
  const [job] = await table.load(
    Buffer.from(rows.map((r) => JSON.stringify(r)).join("\n")),
    {
      sourceFormat: "NEWLINE_DELIMITED_JSON",
      writeDisposition: "WRITE_TRUNCATE",
      autodetect: true,
    }
  );

  console.log(`  Synced ${rows.length} inventory items (job: ${job.id})`);
}

async function syncStockMovements() {
  console.log("Syncing stock movements...");

  const movements = await prisma.stockMovement.findMany({
    include: {
      inventoryItem: {
        include: {
          warehouse: {
            include: { organisation: true },
          },
        },
      },
      operator: true,
    },
  });

  const rows = movements.map((m) => ({
    movement_id: m.id,
    movement_type: m.type,
    quantity: m.quantity,
    timestamp: m.timestamp.toISOString(),
    notes: m.notes || "",
    sku: m.inventoryItem.sku,
    item_name: m.inventoryItem.name,
    inventory_item_id: m.inventoryItemId,
    warehouse_id: m.inventoryItem.warehouseId,
    warehouse_name: m.inventoryItem.warehouse.name,
    organisation_id: m.inventoryItem.warehouse.organisationId,
    organisation_name: m.inventoryItem.warehouse.organisation.name,
    operator_id: m.operatorId,
    operator_name: m.operator.name,
    operator_email: m.operator.email,
    synced_at: new Date().toISOString(),
  }));

  const table = bigquery.dataset(DATASET).table("stock_movements");

  const [job] = await table.load(
    Buffer.from(rows.map((r) => JSON.stringify(r)).join("\n")),
    {
      sourceFormat: "NEWLINE_DELIMITED_JSON",
      writeDisposition: "WRITE_TRUNCATE",
      autodetect: true,
    }
  );

  console.log(`  Synced ${rows.length} stock movements (job: ${job.id})`);
}

async function main() {
  console.log("🔄 Starting Postgres → BigQuery sync...");
  console.log(`   Project: ${process.env.GOOGLE_CLOUD_PROJECT}`);
  console.log(`   Dataset: ${DATASET}`);

  await ensureDataset();
  await syncInventorySnapshot();
  await syncStockMovements();

  console.log("✅ Sync complete!");
}

main()
  .catch((e) => {
    console.error("Sync failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
