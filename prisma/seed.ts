import { PrismaClient, Role, MovementType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data (idempotent)
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();

  // Create 3 organisations
  const orgs = await Promise.all([
    prisma.organisation.create({ data: { id: "org-coastal", name: "Coastal Logistics" } }),
    prisma.organisation.create({ data: { id: "org-meridian", name: "Meridian Stores" } }),
    prisma.organisation.create({ data: { id: "org-tilman", name: "Tilman & Co." } }),
  ]);

  // Create users: 3 per org (Admin, Manager, Operator) = 9 total
  const users = await Promise.all([
    // Coastal Logistics
    prisma.user.create({ data: { email: "admin@coastal.test", name: "Coastal Admin", role: Role.ADMIN, organisationId: "org-coastal" } }),
    prisma.user.create({ data: { email: "manager@coastal.test", name: "Coastal Manager", role: Role.WAREHOUSE_MANAGER, organisationId: "org-coastal" } }),
    prisma.user.create({ data: { email: "operator@coastal.test", name: "Coastal Operator", role: Role.OPERATOR, organisationId: "org-coastal" } }),
    // Meridian Stores
    prisma.user.create({ data: { email: "admin@meridian.test", name: "Meridian Admin", role: Role.ADMIN, organisationId: "org-meridian" } }),
    prisma.user.create({ data: { email: "manager@meridian.test", name: "Meridian Manager", role: Role.WAREHOUSE_MANAGER, organisationId: "org-meridian" } }),
    prisma.user.create({ data: { email: "operator@meridian.test", name: "Meridian Operator", role: Role.OPERATOR, organisationId: "org-meridian" } }),
    // Tilman & Co.
    prisma.user.create({ data: { email: "admin@tilman.test", name: "Tilman Admin", role: Role.ADMIN, organisationId: "org-tilman" } }),
    prisma.user.create({ data: { email: "manager@tilman.test", name: "Tilman Manager", role: Role.WAREHOUSE_MANAGER, organisationId: "org-tilman" } }),
    prisma.user.create({ data: { email: "operator@tilman.test", name: "Tilman Operator", role: Role.OPERATOR, organisationId: "org-tilman" } }),
  ]);

  // Create ~4 warehouses per org (12 total)
  const warehouseData = [
    // Coastal Logistics
    { id: "wh-coastal-1", name: "Chennai Port Hub", location: "Chennai, TN", capacity: 5000, organisationId: "org-coastal" },
    { id: "wh-coastal-2", name: "Vizag Coastal Depot", location: "Visakhapatnam, AP", capacity: 3000, organisationId: "org-coastal" },
    { id: "wh-coastal-3", name: "Kochi Marine Store", location: "Kochi, KL", capacity: 4000, organisationId: "org-coastal" },
    { id: "wh-coastal-4", name: "Mumbai Dock Facility", location: "Mumbai, MH", capacity: 8000, organisationId: "org-coastal" },
    // Meridian Stores
    { id: "wh-meridian-1", name: "Bangalore Central", location: "Bangalore, KA", capacity: 6000, organisationId: "org-meridian" },
    { id: "wh-meridian-2", name: "Hyderabad Mega Store", location: "Hyderabad, TS", capacity: 7000, organisationId: "org-meridian" },
    { id: "wh-meridian-3", name: "Pune Distribution Center", location: "Pune, MH", capacity: 4500, organisationId: "org-meridian" },
    { id: "wh-meridian-4", name: "Delhi NCR Warehouse", location: "Gurugram, HR", capacity: 9000, organisationId: "org-meridian" },
    // Tilman & Co.
    { id: "wh-tilman-1", name: "Coimbatore Textiles Hub", location: "Coimbatore, TN", capacity: 3500, organisationId: "org-tilman" },
    { id: "wh-tilman-2", name: "Ahmedabad Storage", location: "Ahmedabad, GJ", capacity: 5500, organisationId: "org-tilman" },
    { id: "wh-tilman-3", name: "Jaipur Dry Goods", location: "Jaipur, RJ", capacity: 2500, organisationId: "org-tilman" },
    { id: "wh-tilman-4", name: "Lucknow Regional Center", location: "Lucknow, UP", capacity: 4000, organisationId: "org-tilman" },
  ];

  const warehouses = await Promise.all(
    warehouseData.map((w) => prisma.warehouse.create({ data: w }))
  );

  // Create ~80 inventory items distributed across warehouses
  const skuPrefixes = ["ELC", "MEC", "PKG", "RAW", "FIN", "CHM", "TXT", "HRD"];
  const itemNames = [
    "Industrial Motor", "Circuit Board", "Packing Foam", "Steel Rods", "Finished Gear",
    "Cleaning Solvent", "Cotton Fabric", "Hex Bolts M8", "LED Panel", "Hydraulic Pump",
    "Thermal Paste", "Copper Wire 2mm", "Cardboard Box Large", "Aluminum Sheet",
    "Painted Housing", "Acetone 5L", "Polyester Roll", "Stainless Screws",
    "Power Supply Unit", "Servo Motor", "Bubble Wrap", "Iron Rebar", "Wheel Assembly",
    "Isopropyl Alcohol", "Nylon Thread", "Brass Fittings", "Relay Module",
    "Bearing 6205", "Shrink Film", "PVC Pipe 4in", "Chrome Plated Shaft",
    "Sulfuric Acid 1L", "Silk Blend Fabric", "Titanium Bolt M10",
  ];

  const inventoryItems: Array<{ id: string; warehouseId: string }> = [];
  let itemIndex = 0;

  for (const warehouse of warehouses) {
    const itemCount = 5 + Math.floor(Math.random() * 4); // 5-8 items per warehouse
    for (let i = 0; i < itemCount && itemIndex < 80; i++) {
      const prefix = skuPrefixes[itemIndex % skuPrefixes.length];
      const sku = `${prefix}-${String(itemIndex + 1).padStart(4, "0")}`;
      const name = itemNames[itemIndex % itemNames.length];
      const quantity = Math.floor(Math.random() * 500) + 10;

      const item = await prisma.inventoryItem.create({
        data: {
          sku,
          name: `${name} (${sku})`,
          quantity,
          warehouseId: warehouse.id,
        },
      });
      inventoryItems.push({ id: item.id, warehouseId: warehouse.id });
      itemIndex++;
    }
  }

  console.log(`  Created ${inventoryItems.length} inventory items`);

  // Create ~400 stock movements over the last 90 days
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get operators per org for movements
  const operatorsByOrg: Record<string, string> = {
    "org-coastal": users[2].id,  // Coastal Operator
    "org-meridian": users[5].id, // Meridian Operator
    "org-tilman": users[8].id,   // Tilman Operator
  };

  const managersByOrg: Record<string, string> = {
    "org-coastal": users[1].id,
    "org-meridian": users[4].id,
    "org-tilman": users[7].id,
  };

  // Map warehouse to org
  const warehouseToOrg: Record<string, string> = {};
  for (const w of warehouseData) {
    warehouseToOrg[w.id] = w.organisationId;
  }

  // Map item to warehouse
  const itemToWarehouse: Record<string, string> = {};
  for (const item of inventoryItems) {
    itemToWarehouse[item.id] = item.warehouseId;
  }

  const movements = [];
  for (let i = 0; i < 400; i++) {
    const item = inventoryItems[Math.floor(Math.random() * inventoryItems.length)];
    const warehouseId = item.warehouseId;
    const orgId = warehouseToOrg[warehouseId];
    // Alternate between operators and managers doing movements
    const operatorId = Math.random() > 0.3 ? operatorsByOrg[orgId] : managersByOrg[orgId];
    const type = Math.random() > 0.4 ? MovementType.INBOUND : MovementType.OUTBOUND;
    const quantity = Math.floor(Math.random() * 50) + 1;
    const timestamp = new Date(
      ninetyDaysAgo.getTime() + Math.random() * (now.getTime() - ninetyDaysAgo.getTime())
    );

    movements.push({
      type,
      quantity,
      inventoryItemId: item.id,
      operatorId,
      timestamp,
      notes: type === MovementType.INBOUND ? "Supplier delivery" : "Customer order fulfillment",
    });
  }

  // Batch create movements
  await prisma.stockMovement.createMany({ data: movements });

  console.log(`  Created 400 stock movements`);
  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
