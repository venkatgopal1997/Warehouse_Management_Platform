import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function WarehouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const warehouse = await prisma.warehouse.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
    },
    include: {
      inventoryItems: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { movements: true } },
        },
      },
    },
  });

  if (!warehouse) {
    notFound();
  }

  const totalStock = warehouse.inventoryItems.reduce((sum, i) => sum + i.quantity, 0);
  const utilization = Math.round((totalStock / warehouse.capacity) * 100);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/warehouses" className="text-sm text-blue-600 hover:underline">
            ← Back to Warehouses
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{warehouse.name}</h1>
          <p className="text-gray-500">{warehouse.location}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Capacity</p>
          <p className="text-2xl font-bold text-gray-900">{warehouse.capacity.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Stock</p>
          <p className="text-2xl font-bold text-gray-900">{totalStock.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Utilization</p>
          <p className="text-2xl font-bold text-gray-900">{utilization}%</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${
                utilization > 80 ? "bg-red-500" : utilization > 50 ? "bg-yellow-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.min(utilization, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Inventory Items */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Inventory Items ({warehouse.inventoryItems.length})
      </h2>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Movements</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {warehouse.inventoryItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No inventory items in this warehouse yet.
                </td>
              </tr>
            ) : (
              warehouse.inventoryItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{item.sku}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.name}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item._count.movements}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
