/**
 * Sync script: Postgres → BigQuery
 *
 * Uses streaming inserts (insertAll) instead of load jobs.
 * WRITE_TRUNCATE is achieved by deleting all rows first, then inserting.
 */

import { BigQuery } from "@google-cloud/bigquery";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const DATASET = process.env.BIGQUERY_DATASET || "warehouse_analytics";

async function ensureDataset() {
  const dataset = bigquery.dataset(DATASET);
  const [exists] = await dataset.exists();
  if (!exists) {
    await bigquery.createDataset(DATASET, { location: "asia-south1" });
    console.log(`Created dataset: ${DATASET}`);
  }
}

async function ensureTable(tableName: string, schema: object[]) {
  const table = bigquery.dataset(DATASET).table(tableName);
  const [exists] = await table.exists();
  if (!exists) {
    await bigquery.dataset(DATASET).createTable(tableName, { schema: { fields: schema } });
    console.log(`  Created table: ${tableName}`);
  }
}

async function truncateTable(tableName: string) {
  const query = `DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.${tableName}\` WHERE true`;
  await bigquery.query({ query });
}

async function syncInventorySnapshot() {
  console.log("Syncing inventory snapshot...");

  const schema = [
    { name: "item_id", type: "STRING" },
    { name: "sku", type: "STRING" },
    { name: "item_name", type: "STRING" },
    { name: "quantity", type: "INTEGER" },
    { name: "warehouse_id", type: "STRING" },
    { name: "warehouse_name", type: "STRING" },
    { name: "warehouse_location", type: "STRING" },
    { name: "warehouse_capacity", type: "INTEGER" },
    { name: "organisation_id", type: "STRING" },
    { name: "organisation_name", type: "STRING" },
    { name: "synced_at", type: "TIMESTAMP" },
  ];

  await ensureTable("inventory_snapshot", schema);
  await truncateTable("inventory_snapshot");

  const items = await prisma.inventoryItem.findMany({
    include: {
      warehouse: {
        include: { organisation: true },
      },
    },
  });

  if (items.length === 0) {
    console.log("  No inventory items to sync.");
    return;
  }

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
  await table.insert(rows);

  console.log(`  Synced ${rows.length} inventory items`);
}

async function syncStockMovements() {
  console.log("Syncing stock movements...");

  const schema = [
    { name: "movement_id", type: "STRING" },
    { name: "movement_type", type: "STRING" },
    { name: "quantity", type: "INTEGER" },
    { name: "timestamp", type: "TIMESTAMP" },
    { name: "notes", type: "STRING" },
    { name: "sku", type: "STRING" },
    { name: "item_name", type: "STRING" },
    { name: "inventory_item_id", type: "STRING" },
    { name: "warehouse_id", type: "STRING" },
    { name: "warehouse_name", type: "STRING" },
    { name: "organisation_id", type: "STRING" },
    { name: "organisation_name", type: "STRING" },
    { name: "operator_id", type: "STRING" },
    { name: "operator_name", type: "STRING" },
    { name: "operator_email", type: "STRING" },
    { name: "synced_at", type: "TIMESTAMP" },
  ];

  await ensureTable("stock_movements", schema);
  await truncateTable("stock_movements");

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

  if (movements.length === 0) {
    console.log("  No movements to sync.");
    return;
  }

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

  // Insert in batches of 500 (BigQuery streaming insert limit)
  const table = bigquery.dataset(DATASET).table("stock_movements");
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await table.insert(batch);
  }

  console.log(`  Synced ${rows.length} stock movements`);
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