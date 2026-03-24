import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

interface GameDataItem {
  name: string;
  isRawMaterial: boolean;
  isFound: boolean;
  isFinalProduct: boolean;
  volume?: number;
}
interface GameDataAsteroidType {
  name: string;
  locations: string[];
  items: string[];
}
interface GameDataDecomposition {
  sourceItem: string;
  refinery?: string;
  inputQty: number;
  outputs: { item: string; quantity: number }[];
}
interface GameDataBlueprint {
  outputItem: string;
  factory: string;
  outputQty: number;
  isDefault: boolean;
  inputs: { item: string; quantity: number }[];
}
interface GameData {
  factories: string[];
  refineries: string[];
  locations: string[];
  items: GameDataItem[];
  asteroidTypes: GameDataAsteroidType[];
  decompositions: GameDataDecomposition[];
  blueprints: GameDataBlueprint[];
}

export async function seedStatic() {
  const dataPath = join(process.cwd(), "data/game-data.json");
  const data: GameData = JSON.parse(readFileSync(dataPath, "utf-8"));

  console.log("[seed-static] Clearing static tables...");
  await prisma.blueprintInput.deleteMany();
  await prisma.blueprint.deleteMany();
  await prisma.decompositionOutput.deleteMany();
  await prisma.decomposition.deleteMany();
  await prisma.itemAsteroidType.deleteMany();
  await prisma.asteroidTypeLocation.deleteMany();
  await prisma.asteroidType.deleteMany();
  await prisma.location.deleteMany();
  await prisma.item.deleteMany();
  await prisma.factory.deleteMany();
  await prisma.refinery.deleteMany();

  // Factories
  for (const name of data.factories) {
    await prisma.factory.create({ data: { name } });
  }
  console.log(`[seed-static]   ✓ ${data.factories.length} factories`);

  // Refineries
  for (const name of data.refineries) {
    await prisma.refinery.create({ data: { name } });
  }
  console.log(`[seed-static]   ✓ ${data.refineries.length} refineries`);

  // Locations
  for (const name of data.locations) {
    await prisma.location.create({ data: { name } });
  }
  console.log(`[seed-static]   ✓ ${data.locations.length} locations`);

  // Items
  for (const item of data.items) {
    await prisma.item.create({ data: item });
  }
  console.log(`[seed-static]   ✓ ${data.items.length} items`);

  // Asteroid types
  for (const at of data.asteroidTypes) {
    const created = await prisma.asteroidType.create({ data: { name: at.name } });
    for (const locName of at.locations) {
      const loc = await prisma.location.findUnique({ where: { name: locName } });
      if (loc) {
        await prisma.asteroidTypeLocation.create({
          data: { asteroidTypeId: created.id, locationId: loc.id },
        });
      }
    }
    for (const itemName of at.items) {
      const item = await prisma.item.findUnique({ where: { name: itemName } });
      if (item) {
        await prisma.itemAsteroidType.create({
          data: { itemId: item.id, asteroidTypeId: created.id },
        });
      }
    }
  }
  console.log(`[seed-static]   ✓ ${data.asteroidTypes.length} asteroid types`);

  // Decompositions
  for (const d of data.decompositions) {
    const source = await prisma.item.findUnique({ where: { name: d.sourceItem } });
    if (!source) {
      console.warn(`[seed-static]   ⚠ Item not found for decomposition: ${d.sourceItem}`);
      continue;
    }
    const decomp = await prisma.decomposition.create({
      data: { sourceItemId: source.id, refinery: d.refinery ?? "", inputQty: d.inputQty },
    });
    for (const out of d.outputs) {
      const outItem = await prisma.item.findUnique({ where: { name: out.item } });
      if (outItem) {
        await prisma.decompositionOutput.create({
          data: { decompositionId: decomp.id, itemId: outItem.id, quantity: out.quantity },
        });
      }
    }
  }
  console.log(`[seed-static]   ✓ ${data.decompositions.length} decompositions`);

  // Blueprints
  for (const bp of data.blueprints) {
    const outputItem = await prisma.item.findUnique({ where: { name: bp.outputItem } });
    if (!outputItem) {
      console.warn(`[seed-static]   ⚠ Item not found for blueprint: ${bp.outputItem}`);
      continue;
    }
    const created = await prisma.blueprint.create({
      data: {
        outputItemId: outputItem.id,
        factory: bp.factory ?? "",
        outputQty: bp.outputQty,
        isDefault: bp.isDefault,
      },
    });
    for (const inp of bp.inputs) {
      const inpItem = await prisma.item.findUnique({ where: { name: inp.item } });
      if (inpItem) {
        await prisma.blueprintInput.create({
          data: { blueprintId: created.id, itemId: inpItem.id, quantity: inp.quantity },
        });
      }
    }
  }
  console.log(`[seed-static]   ✓ ${data.blueprints.length} blueprints`);

  console.log("[seed-static] Done.");
}

seedStatic()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
