import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import fs from "fs";
import path from "path";

type SeedData = {
  factories: string[];
  locations: string[];
  items: { name: string; isRawMaterial: boolean; isFound: boolean; isFinalProduct: boolean }[];
  asteroidTypes: { name: string; locations: string[]; items: string[] }[];
  decompositions: { sourceItem: string; refinery?: string; inputQty: number; isDefault?: boolean; outputs: { item: string; quantity: number }[] }[];
  blueprints: { outputItem: string; factory: string; outputQty: number; isDefault: boolean; inputs: { item: string; quantity: number }[] }[];
};

async function applyAdditive(data: SeedData) {
  // Factories
  for (const name of data.factories) {
    const n = normalizeName(name);
    await prisma.factory.upsert({ where: { name: n }, update: {}, create: { name: n } });
  }

  // Locations
  for (const name of data.locations) {
    const n = normalizeName(name);
    await prisma.location.upsert({ where: { name: n }, update: {}, create: { name: n } });
  }

  // Items
  for (const item of data.items) {
    const n = normalizeName(item.name);
    await prisma.item.upsert({
      where: { name: n },
      update: { isRawMaterial: item.isRawMaterial, isFound: item.isFound, isFinalProduct: item.isFinalProduct },
      create: { ...item, name: n },
    });
  }

  // Asteroid types + links (add missing links, don't remove existing)
  for (const at of data.asteroidTypes) {
    const n = normalizeName(at.name);
    const created = await prisma.asteroidType.upsert({ where: { name: n }, update: {}, create: { name: n } });
    for (const locName of at.locations) {
      const loc = await prisma.location.findUnique({ where: { name: normalizeName(locName) } });
      if (loc) {
        await prisma.asteroidTypeLocation.upsert({
          where: { asteroidTypeId_locationId: { asteroidTypeId: created.id, locationId: loc.id } },
          update: {},
          create: { asteroidTypeId: created.id, locationId: loc.id },
        });
      }
    }
    for (const itemName of at.items) {
      const item = await prisma.item.findUnique({ where: { name: normalizeName(itemName) } });
      if (item) {
        await prisma.itemAsteroidType.upsert({
          where: { itemId_asteroidTypeId: { itemId: item.id, asteroidTypeId: created.id } },
          update: {},
          create: { itemId: item.id, asteroidTypeId: created.id },
        });
      }
    }
  }

  // Decompositions — upsert by (sourceItem, refinery), replace outputs
  for (const d of data.decompositions) {
    const source = await prisma.item.findUnique({ where: { name: normalizeName(d.sourceItem) } });
    if (!source) continue;
    const normalizedRefinery = normalizeName(d.refinery ?? "");
    const decomp = await prisma.decomposition.upsert({
      where: { sourceItemId_refinery: { sourceItemId: source.id, refinery: normalizedRefinery } },
      update: { inputQty: d.inputQty, isDefault: d.isDefault ?? false },
      create: { sourceItemId: source.id, refinery: normalizedRefinery, inputQty: d.inputQty, isDefault: d.isDefault ?? false },
    });
    // Replace outputs for this decomposition
    await prisma.decompositionOutput.deleteMany({ where: { decompositionId: decomp.id } });
    for (const out of d.outputs) {
      const outItem = await prisma.item.findUnique({ where: { name: normalizeName(out.item) } });
      if (outItem) {
        await prisma.decompositionOutput.create({ data: { decompositionId: decomp.id, itemId: outItem.id, quantity: out.quantity } });
      }
    }
  }

  // Blueprints — match by (outputItem, factory normalized), update or create; never delete
  for (const bp of data.blueprints) {
    const outputItem = await prisma.item.findUnique({ where: { name: normalizeName(bp.outputItem) } });
    if (!outputItem) continue;
    const normalizedFactory = normalizeName(bp.factory ?? "");
    // Fetch all blueprints for this item and compare factory names normalized (tolerates existing un-normalized values)
    const candidates = await prisma.blueprint.findMany({ where: { outputItemId: outputItem.id } });
    const existing = candidates.find(b => normalizeName(b.factory) === normalizedFactory) ?? null;
    let blueprintId: string;
    if (existing) {
      await prisma.blueprint.update({
        where: { id: existing.id },
        data: { factory: normalizedFactory, outputQty: bp.outputQty, isDefault: bp.isDefault },
      });
      blueprintId = existing.id;
    } else {
      const created = await prisma.blueprint.create({
        data: { outputItemId: outputItem.id, factory: normalizedFactory, outputQty: bp.outputQty, isDefault: bp.isDefault },
      });
      blueprintId = created.id;
    }
    // Replace inputs for this blueprint
    await prisma.blueprintInput.deleteMany({ where: { blueprintId } });
    for (const inp of bp.inputs) {
      const inpItem = await prisma.item.findUnique({ where: { name: normalizeName(inp.item) } });
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
    const source = await prisma.item.findUnique({ where: { name: normalizeName(d.sourceItem) } });
    if (!source) continue;
    const normalizedRefinery = normalizeName(d.refinery ?? "");
    const decomp = await prisma.decomposition.create({
      data: { sourceItemId: source.id, refinery: normalizedRefinery, inputQty: d.inputQty, isDefault: d.isDefault ?? false },
    });
    for (const out of d.outputs) {
      const outItem = await prisma.item.findUnique({ where: { name: normalizeName(out.item) } });
      if (outItem) await prisma.decompositionOutput.create({ data: { decompositionId: decomp.id, itemId: outItem.id, quantity: out.quantity } });
    }
  }

  for (const bp of data.blueprints) {
    const outputItem = await prisma.item.findUnique({ where: { name: bp.outputItem } });
    if (!outputItem) continue;
    const created = await prisma.blueprint.create({
      data: { outputItemId: outputItem.id, factory: normalizeName(bp.factory ?? ""), outputQty: bp.outputQty, isDefault: bp.isDefault },
    });
    for (const inp of bp.inputs) {
      const inpItem = await prisma.item.findUnique({ where: { name: normalizeName(inp.item) } });
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
