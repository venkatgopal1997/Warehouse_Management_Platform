import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await requireSession();

  // Fetch summary stats from Postgres (transactional data)
  const [warehouseCount, itemCount, recentMovements] = await Promise.all([
    prisma.warehouse.count({
      where: { organisationId: session.organisationId },
    }),
    prisma.inventoryItem.count({
      where: { warehouse: { organisationId: session.organisationId } },
    }),
    prisma.stockMovement.count({
      where: {
        inventoryItem: {
          warehouse: { organisationId: session.organisationId },
        },
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-8">
        Welcome back, {session.name || session.email} · {session.organisationName}
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-500">Warehouses</p>
          <p className="text-3xl font-bold text-gray-900">{warehouseCount}</p>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-500">Inventory Items</p>
          <p className="text-3xl font-bold text-gray-900">{itemCount}</p>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-500">Movements (7 days)</p>
          <p className="text-3xl font-bold text-gray-900">{recentMovements}</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/warehouses"
          className="bg-white rounded-lg border p-6 hover:border-blue-300 transition-colors"
        >
          <h3 className="font-semibold text-gray-900">Manage Warehouses</h3>
          <p className="text-sm text-gray-500 mt-1">
            View and manage warehouse locations
          </p>
        </Link>
        <Link
          href="/dashboard/inventory"
          className="bg-white rounded-lg border p-6 hover:border-blue-300 transition-colors"
        >
          <h3 className="font-semibold text-gray-900">Inventory</h3>
          <p className="text-sm text-gray-500 mt-1">
            Track stock levels across warehouses
          </p>
        </Link>
        <Link
          href="/dashboard/movements"
          className="bg-white rounded-lg border p-6 hover:border-blue-300 transition-colors"
        >
          <h3 className="font-semibold text-gray-900">Stock Movements</h3>
          <p className="text-sm text-gray-500 mt-1">
            Record inbound and outbound movements
          </p>
        </Link>
        <Link
          href="/dashboard/analytics"
          className="bg-white rounded-lg border p-6 hover:border-blue-300 transition-colors"
        >
          <h3 className="font-semibold text-gray-900">Analytics</h3>
          <p className="text-sm text-gray-500 mt-1">
            Charts and insights powered by BigQuery
          </p>
        </Link>
      </div>
    </div>
  );
}
