import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertPermission } from "@/lib/rbac";
import { MovementType } from "@prisma/client";
import { z } from "zod";
export const dynamic = "force-dynamic";

const createMovementSchema = z.object({
  type: z.nativeEnum(MovementType),
  quantity: z.number().int().positive(),
  inventoryItemId: z.string(),
  notes: z.string().optional(),
});

// GET /api/movements
export async function GET(request: NextRequest) {
  const session = await requireSession();
  assertPermission(session.role, "movement:read");

  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const warehouseId = request.nextUrl.searchParams.get("warehouseId");

  const movements = await prisma.stockMovement.findMany({
    where: {
      inventoryItem: {
        warehouse: {
          organisationId: session.organisationId, // Multi-tenant isolation
          ...(warehouseId ? { id: warehouseId } : {}),
        },
      },
    },
    include: {
      inventoryItem: {
        select: { sku: true, name: true, warehouse: { select: { name: true } } },
      },
      operator: { select: { name: true, email: true } },
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return NextResponse.json(movements);
}

// POST /api/movements — record a stock movement
export async function POST(request: NextRequest) {
  const session = await requireSession();
  assertPermission(session.role, "movement:create");

  const body = await request.json();
  const parsed = createMovementSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify the inventory item belongs to the user's org
  const item = await prisma.inventoryItem.findFirst({
    where: {
      id: parsed.data.inventoryItemId,
      warehouse: {
        organisationId: session.organisationId,
      },
    },
  });

  if (!item) {
    return NextResponse.json(
      { error: "Inventory item not found or access denied" },
      { status: 403 }
    );
  }

  // For outbound, check if we have enough stock
  if (parsed.data.type === MovementType.OUTBOUND && item.quantity < parsed.data.quantity) {
    return NextResponse.json(
      { error: "Insufficient stock" },
      { status: 400 }
    );
  }

  // Create movement and update quantity in a transaction
  const movement = await prisma.$transaction(async (tx) => {
    const newMovement = await tx.stockMovement.create({
      data: {
        type: parsed.data.type,
        quantity: parsed.data.quantity,
        inventoryItemId: parsed.data.inventoryItemId,
        operatorId: session.userId,
        notes: parsed.data.notes,
      },
    });

    // Update inventory quantity
    const delta = parsed.data.type === MovementType.INBOUND
      ? parsed.data.quantity
      : -parsed.data.quantity;

    await tx.inventoryItem.update({
      where: { id: parsed.data.inventoryItemId },
      data: { quantity: { increment: delta } },
    });

    return newMovement;
  });

  return NextResponse.json(movement, { status: 201 });
}
