import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { assertPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
// GET /api/analytics — fetch analytics data
// In production: reads from BigQuery
// In local dev (no BigQuery configured): falls back to Postgres/SQLite
export async function GET() {
  const session = await requireSession();
  assertPermission(session.role, "analytics:read");

  try {
    // Try BigQuery first (production)
    if (
      process.env.GOOGLE_CLOUD_PROJECT &&
      process.env.GOOGLE_CLOUD_PROJECT !== "your-project-id"
    ) {
      const {
        getStockLevelsByWarehouse,
        getMovementVelocity,
        getTopMovers,
        getLowStockItems,
      } = await import("@/lib/bigquery");

      const [stockLevels, velocity, topMovers, lowStock] = await Promise.all([
        getStockLevelsByWarehouse(session.organisationId),
        getMovementVelocity(session.organisationId),
        getTopMovers(session.organisationId),
        getLowStockItems(session.organisationId),
      ]);

      return NextResponse.json({ stockLevels, velocity, topMovers, lowStock });
    }

    // Fallback: read from Postgres/SQLite for local dev
    const stockLevels = await getStockLevelsFromDB(session.organisationId);
    const velocity = await getVelocityFromDB(session.organisationId);
    const topMovers = await getTopMoversFromDB(session.organisationId);
    const lowStock = await getLowStockFromDB(session.organisationId);

    return NextResponse.json({ stockLevels, velocity, topMovers, lowStock });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}

// --- Fallback queries using Prisma (for local dev without BigQuery) ---

async function getStockLevelsFromDB(organisationId: string) {
  const warehouses = await prisma.warehouse.findMany({
    where: { organisationId },
    include: {
      inventoryItems: { select: { quantity: true, id: true } },
    },
  });

  return warehouses.map((w) => ({
    warehouse_name: w.name,
    warehouse_location: w.location,
    total_stock: w.inventoryItems.reduce((sum, i) => sum + i.quantity, 0),
    unique_items: w.inventoryItems.length,
  }));
}

async function getVelocityFromDB(organisationId: string) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const movements = await prisma.stockMovement.findMany({
    where: {
      inventoryItem: {
        warehouse: { organisationId },
      },
      timestamp: { gte: ninetyDaysAgo },
    },
    select: { type: true, quantity: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });

  // Group by date
  const grouped: Record<string, { inbound: number; outbound: number; count: number }> = {};
  for (const m of movements) {
    const date = m.timestamp.toISOString().split("T")[0];
    if (!grouped[date]) grouped[date] = { inbound: 0, outbound: 0, count: 0 };
    grouped[date].count++;
    if (m.type === "INBOUND") grouped[date].inbound += m.quantity;
    else grouped[date].outbound += m.quantity;
  }

  return Object.entries(grouped).map(([date, data]) => ({
    date,
    movement_type: "ALL",
    total_quantity: data.inbound + data.outbound,
    movement_count: data.count,
  }));
}

async function getTopMoversFromDB(organisationId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const movements = await prisma.stockMovement.findMany({
    where: {
      inventoryItem: {
        warehouse: { organisationId },
      },
      timestamp: { gte: thirtyDaysAgo },
    },
    include: {
      inventoryItem: {
        select: { sku: true, name: true, warehouse: { select: { name: true } } },
      },
    },
  });

  // Group by item
  const grouped: Record<string, {
    sku: string;
    item_name: string;
    warehouse_name: string;
    total_inbound: number;
    total_outbound: number;
    movement_count: number;
  }> = {};

  for (const m of movements) {
    const key = m.inventoryItemId;
    if (!grouped[key]) {
      grouped[key] = {
        sku: m.inventoryItem.sku,
        item_name: m.inventoryItem.name,
        warehouse_name: m.inventoryItem.warehouse.name,
        total_inbound: 0,
        total_outbound: 0,
        movement_count: 0,
      };
    }
    grouped[key].movement_count++;
    if (m.type === "INBOUND") grouped[key].total_inbound += m.quantity;
    else grouped[key].total_outbound += m.quantity;
  }

  return Object.values(grouped)
    .sort((a, b) => b.movement_count - a.movement_count)
    .slice(0, 20);
}

async function getLowStockFromDB(organisationId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: {
      warehouse: { organisationId },
      quantity: { lt: 50 },
    },
    include: { warehouse: { select: { name: true } } },
    orderBy: { quantity: "asc" },
  });

  return items.map((i) => ({
    sku: i.sku,
    item_name: i.name,
    warehouse_name: i.warehouse.name,
    quantity: i.quantity,
    stock_status: i.quantity < 20 ? "CRITICAL" : "LOW",
  }));
}