import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

type SeedData = {
  factories: string[];
  locations: string[];
  items: { name: string; isRawMaterial: boolean; isFound: boolean; isFinalProduct: boolean }[];
  asteroidTypes: { name: string; locations: string[]; items: string[] }[];
  decompositions: { sourceItem: string; inputQty: number; outputs: { item: string; quantity: number }[] }[];
  blueprints: { outputItem: string; factory: string; outputQty: number; isDefault: boolean; inputs: { item: string; quantity: number }[] }[];
};

export async function POST() {
  let data: SeedData;
  try {
    const seedPath = path.join(process.cwd(), "prisma/seed.json");
    data = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
  } catch {
    return NextResponse.json({ error: "Could not read prisma/seed.json" }, { status: 500 });
  }

  try {
    // Clear game data
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

    // Factories
    for (const name of data.factories) {
      await prisma.factory.create({ data: { name } });
    }

    // Locations
    for (const name of data.locations) {
      await prisma.location.create({ data: { name } });
    }

    // Items
    for (const item of data.items) {
      await prisma.item.create({ data: item });
    }

    // Asteroid types
    for (const at of data.asteroidTypes) {
      const created = await prisma.asteroidType.create({ data: { name: at.name } });
      for (const locName of at.locations) {
        const loc = await prisma.location.findUnique({ where: { name: locName } });
        if (loc) await prisma.asteroidTypeLocation.create({ data: { asteroidTypeId: created.id, locationId: loc.id } });
      }
      for (const itemName of at.items) {
        const item = await prisma.item.findUnique({ where: { name: itemName } });
        if (item) await prisma.itemAsteroidType.create({ data: { itemId: item.id, asteroidTypeId: created.id } });
      }
    }

    // Decompositions
    for (const d of data.decompositions) {
      const source = await prisma.item.findUnique({ where: { name: d.sourceItem } });
      if (!source) continue;
      const decomp = await prisma.decomposition.create({ data: { sourceItemId: source.id, inputQty: d.inputQty } });
      for (const out of d.outputs) {
        const outItem = await prisma.item.findUnique({ where: { name: out.item } });
        if (outItem) await prisma.decompositionOutput.create({ data: { decompositionId: decomp.id, itemId: outItem.id, quantity: out.quantity } });
      }
    }

    // Blueprints
    for (const bp of data.blueprints) {
      const outputItem = await prisma.item.findUnique({ where: { name: bp.outputItem } });
      if (!outputItem) continue;
      const created = await prisma.blueprint.create({
        data: { outputItemId: outputItem.id, factory: bp.factory ?? "", outputQty: bp.outputQty, isDefault: bp.isDefault },
      });
      for (const inp of bp.inputs) {
        const inpItem = await prisma.item.findUnique({ where: { name: inp.item } });
        if (inpItem) await prisma.blueprintInput.create({ data: { blueprintId: created.id, itemId: inpItem.id, quantity: inp.quantity } });
      }
    }

    return NextResponse.json({
      ok: true,
      counts: {
        factories: data.factories.length,
        locations: data.locations.length,
        items: data.items.length,
        asteroidTypes: data.asteroidTypes.length,
        decompositions: data.decompositions.length,
        blueprints: data.blueprints.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
