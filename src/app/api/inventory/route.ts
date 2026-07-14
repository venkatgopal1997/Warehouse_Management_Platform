import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertPermission } from "@/lib/rbac";
import { z } from "zod";
export const dynamic = "force-dynamic";

const createInventorySchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(0),
  warehouseId: z.string(),
});

// GET /api/inventory
export async function GET(request: NextRequest) {
  const session = await requireSession();
  assertPermission(session.role, "inventory:read");

  const warehouseId = request.nextUrl.searchParams.get("warehouseId");

  const items = await prisma.inventoryItem.findMany({
    where: {
      warehouse: {
        organisationId: session.organisationId, // Multi-tenant isolation
      },
      ...(warehouseId ? { warehouseId } : {}),
    },
    include: {
      warehouse: { select: { name: true, location: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(items);
}

// POST /api/inventory
export async function POST(request: NextRequest) {
  const session = await requireSession();
  assertPermission(session.role, "inventory:create");

  const body = await request.json();
  const parsed = createInventorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify the warehouse belongs to the user's org
  const warehouse = await prisma.warehouse.findFirst({
    where: {
      id: parsed.data.warehouseId,
      organisationId: session.organisationId,
    },
  });

  if (!warehouse) {
    return NextResponse.json(
      { error: "Warehouse not found or access denied" },
      { status: 403 }
    );
  }

  const item = await prisma.inventoryItem.create({
    data: parsed.data,
  });

  return NextResponse.json(item, { status: 201 });
}
