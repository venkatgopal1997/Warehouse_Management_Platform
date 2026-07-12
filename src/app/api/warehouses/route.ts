import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertPermission } from "@/lib/rbac";
import { z } from "zod";

const createWarehouseSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().min(1).max(200),
  capacity: z.number().int().positive(),
});

// GET /api/warehouses — list warehouses for current org
export async function GET() {
  const session = await requireSession();
  assertPermission(session.role, "warehouse:read");

  const warehouses = await prisma.warehouse.findMany({
    where: { organisationId: session.organisationId },
    include: {
      _count: { select: { inventoryItems: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(warehouses);
}

// POST /api/warehouses — create a new warehouse
export async function POST(request: NextRequest) {
  const session = await requireSession();
  assertPermission(session.role, "warehouse:create");

  const body = await request.json();
  const parsed = createWarehouseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      ...parsed.data,
      organisationId: session.organisationId, // ALWAYS scoped to user's org
    },
  });

  return NextResponse.json(warehouse, { status: 201 });
}
