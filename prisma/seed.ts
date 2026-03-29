import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import data from "./seed.json";

type SeedItem = {
  name: string;
  typeId: number;
  isRawMaterial: boolean;
  isFound: boolean;
  isFinalProduct: boolean;
  isAsteroid?: boolean;
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
        isAsteroid: item.isAsteroid ?? false,
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

  // Build lookup maps (loaded after items are seeded)
  const allItems = await prisma.item.findMany({ select: { id: true, typeId: true } });
  const itemIdByTypeId = new Map(allItems.map((i) => [i.typeId, i.id]));

  const allFactories = await prisma.factory.findMany({ select: { id: true, name: true, typeId: true } });
  const factoryNameByTypeId = new Map(allFactories.map((f) => [f.typeId, f.name]));

  const allRefineries = await prisma.refinery.findMany({ select: { id: true, name: true, typeId: true } });
  const refineryNameByTypeId = new Map(allRefineries.map((r) => [r.typeId, r.name]));

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
    for (const typeId of at.items) {
      const itemId = itemIdByTypeId.get(typeId);
      if (itemId) {
        await prisma.itemAsteroidType.upsert({
          where: { itemId_asteroidTypeId: { itemId, asteroidTypeId: created.id } },
          update: {},
          create: { itemId, asteroidTypeId: created.id },
        });
      } else {
        console.warn(`  ⚠ Item typeId ${typeId} not found for asteroidType: ${at.name}`);
      }
    }
  }
  console.log(`  ✓ ${data.asteroidTypes.length} asteroid types`);

  // Decompositions
  for (const d of data.decompositions) {
    const sourceId = itemIdByTypeId.get(d.sourceTypeId);
    if (!sourceId) { console.warn(`  ⚠ Item typeId ${d.sourceTypeId} not found for decomposition`); continue; }
    const refineryName = refineryNameByTypeId.get(d.facilityTypeId) ?? String(d.facilityTypeId);
    const decomp = await prisma.decomposition.upsert({
      where: { sourceItemId_refinery: { sourceItemId: sourceId, refinery: refineryName } },
      update: { inputQty: d.inputQty, runTime: d.runTime },
      create: { sourceItemId: sourceId, refinery: refineryName, inputQty: d.inputQty, runTime: d.runTime },
    });
    for (const out of d.outputs) {
      const outItemId = itemIdByTypeId.get(out.typeId);
      if (outItemId) {
        await prisma.decompositionOutput.upsert({
          where: { decompositionId_itemId: { decompositionId: decomp.id, itemId: outItemId } },
          update: { quantity: out.quantity },
          create: { decompositionId: decomp.id, itemId: outItemId, quantity: out.quantity },
        });
      } else {
        console.warn(`  ⚠ Output typeId ${out.typeId} not found in decomposition of typeId ${d.sourceTypeId}`);
      }
    }
  }
  console.log(`  ✓ ${data.decompositions.length} decompositions`);

  // Blueprints
  for (const bp of data.blueprints) {
    const outputItemId = itemIdByTypeId.get(bp.outputTypeId);
    if (!outputItemId) { console.warn(`  ⚠ Item typeId ${bp.outputTypeId} not found for blueprint`); continue; }
    const factoryName = factoryNameByTypeId.get(bp.facilityTypeId) ?? String(bp.facilityTypeId);
    const upserted = await prisma.blueprint.upsert({
      where: { outputItemId_factory: { outputItemId, factory: factoryName } },
      update: { outputQty: bp.outputQty, runTime: bp.runTime, gameId: bp.gameId ?? null },
      create: { outputItemId, factory: factoryName, outputQty: bp.outputQty, runTime: bp.runTime, isDefault: false, gameId: bp.gameId ?? null },
    });
    for (const inp of bp.inputs) {
      const inpItemId = itemIdByTypeId.get(inp.typeId);
      if (inpItemId) {
        await prisma.blueprintInput.upsert({
          where: { blueprintId_itemId: { blueprintId: upserted.id, itemId: inpItemId } },
          update: { quantity: inp.quantity },
          create: { blueprintId: upserted.id, itemId: inpItemId, quantity: inp.quantity },
        });
      } else {
        console.warn(`  ⚠ Input typeId ${inp.typeId} not found in blueprint for typeId ${bp.outputTypeId}`);
      }
    }
  }
  console.log(`  ✓ ${data.blueprints.length} blueprints`);

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
