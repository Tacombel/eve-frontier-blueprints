import { NextRequest, NextResponse } from "next/server";
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

async function applyAdditive(data: SeedData) {
  // Factories
  for (const name of data.factories) {
    await prisma.factory.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Locations
  for (const name of data.locations) {
    await prisma.location.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Items
  for (const item of data.items) {
    await prisma.item.upsert({
      where: { name: item.name },
      update: { isRawMaterial: item.isRawMaterial, isFound: item.isFound, isFinalProduct: item.isFinalProduct },
      create: item,
    });
  }

  // Asteroid types + links (add missing links, don't remove existing)
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
      const item = await prisma.item.findUnique({ where: { name: itemName } });
      if (item) {
        await prisma.itemAsteroidType.upsert({
          where: { itemId_asteroidTypeId: { itemId: item.id, asteroidTypeId: created.id } },
          update: {},
          create: { itemId: item.id, asteroidTypeId: created.id },
        });
      }
    }
  }

  // Decompositions — upsert by sourceItem, replace outputs
  for (const d of data.decompositions) {
    const source = await prisma.item.findUnique({ where: { name: d.sourceItem } });
    if (!source) continue;
    const decomp = await prisma.decomposition.upsert({
      where: { sourceItemId: source.id },
      update: { inputQty: d.inputQty },
      create: { sourceItemId: source.id, inputQty: d.inputQty },
    });
    // Replace outputs for this decomposition
    await prisma.decompositionOutput.deleteMany({ where: { decompositionId: decomp.id } });
    for (const out of d.outputs) {
      const outItem = await prisma.item.findUnique({ where: { name: out.item } });
      if (outItem) {
        await prisma.decompositionOutput.create({ data: { decompositionId: decomp.id, itemId: outItem.id, quantity: out.quantity } });
      }
    }
  }

  // Blueprints — match by (outputItem, factory), update or create; never delete
  for (const bp of data.blueprints) {
    const outputItem = await prisma.item.findUnique({ where: { name: bp.outputItem } });
    if (!outputItem) continue;
    const existing = await prisma.blueprint.findFirst({
      where: { outputItemId: outputItem.id, factory: bp.factory ?? "" },
    });
    let blueprintId: string;
    if (existing) {
      await prisma.blueprint.update({
        where: { id: existing.id },
        data: { outputQty: bp.outputQty, isDefault: bp.isDefault },
      });
      blueprintId = existing.id;
    } else {
      const created = await prisma.blueprint.create({
        data: { outputItemId: outputItem.id, factory: bp.factory ?? "", outputQty: bp.outputQty, isDefault: bp.isDefault },
      });
      blueprintId = created.id;
    }
    // Replace inputs for this blueprint
    await prisma.blueprintInput.deleteMany({ where: { blueprintId } });
    for (const inp of bp.inputs) {
      const inpItem = await prisma.item.findUnique({ where: { name: inp.item } });
      if (inpItem) {
        await prisma.blueprintInput.create({ data: { blueprintId, itemId: inpItem.id, quantity: inp.quantity } });
      }
    }
  }
}

async function applyReset(data: SeedData) {
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

  for (const name of data.factories) await prisma.factory.create({ data: { name } });
  for (const name of data.locations) await prisma.location.create({ data: { name } });
  for (const item of data.items) await prisma.item.create({ data: item });

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

  for (const d of data.decompositions) {
    const source = await prisma.item.findUnique({ where: { name: d.sourceItem } });
    if (!source) continue;
    const decomp = await prisma.decomposition.create({ data: { sourceItemId: source.id, inputQty: d.inputQty } });
    for (const out of d.outputs) {
      const outItem = await prisma.item.findUnique({ where: { name: out.item } });
      if (outItem) await prisma.decompositionOutput.create({ data: { decompositionId: decomp.id, itemId: outItem.id, quantity: out.quantity } });
    }
  }

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
}

export async function POST(req: NextRequest) {
  const { mode } = await req.json().catch(() => ({ mode: "merge" }));

  let data: SeedData;
  try {
    const seedPath = path.join(process.cwd(), "prisma/seed.json");
    data = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
  } catch {
    return NextResponse.json({ error: "Could not read prisma/seed.json" }, { status: 500 });
  }

  try {
    if (mode === "reset") await applyReset(data);
    else await applyAdditive(data);

    return NextResponse.json({
      ok: true,
      mode,
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
