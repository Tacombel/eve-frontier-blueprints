import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import data from "./seed.json";

type SeedItem = {
  name: string;
  typeId: number;
  isRawMaterial: boolean;
  isFound: boolean;
  isFinalProduct: boolean;
  volume?: number;
  description?: string | null;
  mass?: number | null;
  radius?: number | null;
  portionSize?: number | null;
  groupName?: string | null;
  groupId?: number | null;
  categoryName?: string | null;
  categoryId?: number | null;
  iconUrl?: string | null;
};

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Facilities
  const factories = data.facilities.filter((f) => f.type === "factory");
  const refineries = data.facilities.filter((f) => f.type === "refinery");
  for (const f of factories) {
    await prisma.factory.upsert({ where: { name: f.name }, update: { typeId: f.typeId ?? null }, create: { name: f.name, typeId: f.typeId ?? null } });
  }
  for (const r of refineries) {
    await prisma.refinery.upsert({ where: { name: r.name }, update: { typeId: r.typeId ?? null }, create: { name: r.name, typeId: r.typeId ?? null } });
  }
  console.log(`  ✓ ${factories.length} factories, ${refineries.length} refineries`);

  // Locations
  for (const name of data.locations) {
    await prisma.location.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`  ✓ ${data.locations.length} locations`);

  // Items
  for (const item of data.items as SeedItem[]) {
    await prisma.item.upsert({
      where: { typeId: item.typeId },
      update: {
        name: item.name,
        isRawMaterial: item.isRawMaterial,
        isFound: item.isFound,
        isFinalProduct: item.isFinalProduct,
        volume: item.volume ?? 0,
        description: item.description ?? null,
        mass: item.mass ?? null,
        radius: item.radius ?? null,
        portionSize: item.portionSize ?? null,
        groupName: item.groupName ?? null,
        groupId: item.groupId ?? null,
        categoryName: item.categoryName ?? null,
        categoryId: item.categoryId ?? null,
        iconUrl: item.iconUrl ?? null,
      },
      create: { ...item, volume: item.volume ?? 0 },
    });
  }
  console.log(`  ✓ ${data.items.length} items`);

  // Asteroid types
  for (const at of data.asteroidTypes) {
    const created = await prisma.asteroidType.upsert({ where: { name: at.name }, update: {}, create: { name: at.name } });
    for (const locName of at.locations) {
      const loc = await prisma.location.findUnique({ where: { name: locName } });
      if (loc) {
        await prisma.asteroidTypeLocation.upsert({
          where: { asteroidTypeId_locationId: { asteroidTypeId: created.id, locationId: loc.id } },
          update: {},
          create: { asteroidTypeId: created.id, locationId: loc.id },
        });
      }
    }
    for (const itemName of at.items) {
      const item = await prisma.item.findFirst({ where: { name: itemName } });
      if (item) {
        await prisma.itemAsteroidType.upsert({
          where: { itemId_asteroidTypeId: { itemId: item.id, asteroidTypeId: created.id } },
          update: {},
          create: { itemId: item.id, asteroidTypeId: created.id },
        });
      }
    }
  }
  console.log(`  ✓ ${data.asteroidTypes.length} asteroid types`);

  // Decompositions
  for (const d of data.decompositions) {
    const source = await prisma.item.findFirst({ where: { name: d.sourceItem } });
    if (!source) { console.warn(`  ⚠ Item not found for decomposition: ${d.sourceItem}`); continue; }
    const decomp = await prisma.decomposition.upsert({
      where: { sourceItemId_refinery: { sourceItemId: source.id, refinery: d.facility } },
      update: { inputQty: d.inputQty, runTime: d.runTime },
      create: { sourceItemId: source.id, refinery: d.facility, inputQty: d.inputQty, runTime: d.runTime },
    });
    for (const out of d.outputs) {
      const outItem = await prisma.item.findFirst({ where: { name: out.item } });
      if (outItem) {
        await prisma.decompositionOutput.upsert({
          where: { decompositionId_itemId: { decompositionId: decomp.id, itemId: outItem.id } },
          update: { quantity: out.quantity },
          create: { decompositionId: decomp.id, itemId: outItem.id, quantity: out.quantity },
        });
      }
    }
  }
  console.log(`  ✓ ${data.decompositions.length} decompositions`);

  // Blueprints — upsert by (outputItemId, factory)
  for (const bp of data.blueprints) {
    const outputItem = await prisma.item.findFirst({ where: { name: bp.outputItem } });
    if (!outputItem) { console.warn(`  ⚠ Item not found for blueprint: ${bp.outputItem}`); continue; }
    const upserted = await prisma.blueprint.upsert({
      where: { outputItemId_factory: { outputItemId: outputItem.id, factory: bp.facility } },
      update: { outputQty: bp.outputQty, runTime: bp.runTime },
      create: { outputItemId: outputItem.id, factory: bp.facility, outputQty: bp.outputQty, runTime: bp.runTime, isDefault: false },
    });
    for (const inp of bp.inputs) {
      const inpItem = await prisma.item.findFirst({ where: { name: inp.item } });
      if (inpItem) {
        await prisma.blueprintInput.upsert({
          where: { blueprintId_itemId: { blueprintId: upserted.id, itemId: inpItem.id } },
          update: { quantity: inp.quantity },
          create: { blueprintId: upserted.id, itemId: inpItem.id, quantity: inp.quantity },
        });
      }
    }
  }
  console.log(`  ✓ ${data.blueprints.length} blueprints`);

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
