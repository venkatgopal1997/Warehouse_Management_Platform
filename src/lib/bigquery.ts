import { BigQuery } from "@google-cloud/bigquery";

let bigquery: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (!bigquery) {
    bigquery = new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
    });
  }
  return bigquery;
}

export const DATASET = process.env.BIGQUERY_DATASET || "warehouse_analytics";

// Queries for the analytics dashboard
export async function getStockLevelsByWarehouse(organisationId: string) {
  const bq = getBigQueryClient();
  const query = `
    SELECT 
      warehouse_name,
      warehouse_location,
      SUM(quantity) as total_stock,
      COUNT(DISTINCT sku) as unique_items
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.inventory_snapshot\`
    WHERE organisation_id = @organisationId
    GROUP BY warehouse_name, warehouse_location
    ORDER BY total_stock DESC
  `;

  const [rows] = await bq.query({
    query,
    params: { organisationId },
  });
  return rows;
}

export async function getMovementVelocity(organisationId: string) {
  const bq = getBigQueryClient();
  const query = `
    SELECT 
      DATE(timestamp) as date,
      movement_type,
      SUM(quantity) as total_quantity,
      COUNT(*) as movement_count
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.stock_movements\`
    WHERE organisation_id = @organisationId
      AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
    GROUP BY date, movement_type
    ORDER BY date ASC
  `;

  const [rows] = await bq.query({
    query,
    params: { organisationId },
  });
  return rows;
}

export async function getTopMovers(organisationId: string) {
  const bq = getBigQueryClient();
  const query = `
    SELECT 
      sku,
      item_name,
      warehouse_name,
      SUM(CASE WHEN movement_type = 'INBOUND' THEN quantity ELSE 0 END) as total_inbound,
      SUM(CASE WHEN movement_type = 'OUTBOUND' THEN quantity ELSE 0 END) as total_outbound,
      COUNT(*) as movement_count
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.stock_movements\`
    WHERE organisation_id = @organisationId
      AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
    GROUP BY sku, item_name, warehouse_name
    ORDER BY movement_count DESC
    LIMIT 20
  `;

  const [rows] = await bq.query({
    query,
    params: { organisationId },
  });
  return rows;
}

// Anomaly detection: low stock items
export async function getLowStockItems(organisationId: string) {
  const bq = getBigQueryClient();
  const query = `
    SELECT 
      sku,
      item_name,
      warehouse_name,
      quantity,
      CASE 
        WHEN quantity < 20 THEN 'CRITICAL'
        WHEN quantity < 50 THEN 'LOW'
        ELSE 'NORMAL'
      END as stock_status
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.inventory_snapshot\`
    WHERE organisation_id = @organisationId
      AND quantity < 50
    ORDER BY quantity ASC
  `;

  const [rows] = await bq.query({
    query,
    params: { organisationId },
  });
  return rows;
}
