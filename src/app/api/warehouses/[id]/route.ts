import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertPermission } from "@/lib/rbac";
import { z } from "zod";

const updateWarehouseSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: z.string().min(1).max(200).optional(),
  capacity: z.number().int().positive().optional(),
});

// GET /api/warehouses/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  assertPermission(session.role, "warehouse:read");
  const { id } = await params;

  const warehouse = await prisma.warehouse.findFirst({
    where: {
      id,
      organisationId: session.organisationId, // Multi-tenant isolation
    },
    include: {
      inventoryItems: { orderBy: { name: "asc" } },
    },
  });

  if (!warehouse) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(warehouse);
}

// PATCH /api/warehouses/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  assertPermission(session.role, "warehouse:update");
  const { id } = await params;

  // Verify warehouse belongs to user's org
  const existing = await prisma.warehouse.findFirst({
    where: { id, organisationId: session.organisationId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateWarehouseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const warehouse = await prisma.warehouse.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(warehouse);
}

// DELETE /api/warehouses/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  assertPermission(session.role, "warehouse:delete");
  const { id } = await params;

  // Verify warehouse belongs to user's org
  const existing = await prisma.warehouse.findFirst({
    where: { id, organisationId: session.organisationId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.warehouse.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
