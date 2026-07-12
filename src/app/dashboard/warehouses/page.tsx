import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { Role } from "@prisma/client";
import Link from "next/link";

export default async function WarehousesPage() {
  const session = await requireSession();

  const warehouses = await prisma.warehouse.findMany({
    where: { organisationId: session.organisationId },
    include: {
      _count: { select: { inventoryItems: true } },
      inventoryItems: {
        select: { quantity: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const canCreate = hasPermission(session.role as Role, "warehouse:create");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Warehouses</h1>
        {canCreate && (
          <Link
            href="/dashboard/warehouses/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Add Warehouse
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map((warehouse) => {
          const totalStock = warehouse.inventoryItems.reduce(
            (sum, item) => sum + item.quantity,
            0
          );
          const utilization = Math.round((totalStock / warehouse.capacity) * 100);

          return (
            <Link
              key={warehouse.id}
              href={`/dashboard/warehouses/${warehouse.id}`}
              className="bg-white rounded-lg border p-5 hover:border-blue-300 transition-colors"
            >
              <h3 className="font-semibold text-gray-900">{warehouse.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{warehouse.location}</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Items</span>
                  <span className="font-medium">{warehouse._count.inventoryItems}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Capacity</span>
                  <span className="font-medium">{utilization}% used</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      utilization > 80
                        ? "bg-red-500"
                        : utilization > 50
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
