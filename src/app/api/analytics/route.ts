import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { assertPermission } from "@/lib/rbac";
import {
  getStockLevelsByWarehouse,
  getMovementVelocity,
  getTopMovers,
  getLowStockItems,
} from "@/lib/bigquery";

// GET /api/analytics — fetch all analytics data from BigQuery
export async function GET() {
  const session = await requireSession();
  assertPermission(session.role, "analytics:read");

  try {
    const [stockLevels, velocity, topMovers, lowStock] = await Promise.all([
      getStockLevelsByWarehouse(session.organisationId),
      getMovementVelocity(session.organisationId),
      getTopMovers(session.organisationId),
      getLowStockItems(session.organisationId),
    ]);

    return NextResponse.json({
      stockLevels,
      velocity,
      topMovers,
      lowStock,
    });
  } catch (error) {
    console.error("BigQuery error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
