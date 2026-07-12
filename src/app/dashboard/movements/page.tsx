import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function MovementsPage() {
  const session = await requireSession();

  const movements = await prisma.stockMovement.findMany({
    where: {
      inventoryItem: {
        warehouse: { organisationId: session.organisationId },
      },
    },
    include: {
      inventoryItem: {
        select: { sku: true, name: true, warehouse: { select: { name: true } } },
      },
      operator: { select: { name: true } },
    },
    orderBy: { timestamp: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Stock Movements</h1>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Item
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Warehouse
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Qty
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Operator
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {movements.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(m.timestamp).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      m.type === "INBOUND"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {m.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {m.inventoryItem.sku}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {m.inventoryItem.warehouse.name}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {m.quantity}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {m.operator.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
