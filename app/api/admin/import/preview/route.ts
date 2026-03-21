import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
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

export type ImportPreview = {
  factories: { new: string[]; existing: string[] };
  locations: { new: string[]; existing: string[] };
  items: { new: string[]; updated: string[]; unchanged: number };
  asteroidTypes: { new: string[]; existing: string[] };
  decompositions: { new: string[]; existing: string[] };
  blueprints: { new: string[]; updated: string[]; unchanged: number };
};

export async function GET() {
  let data: SeedData;
  try {
    const seedPath = path.join(process.cwd(), "prisma/seed.json");
    data = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
  } catch {
    return NextResponse.json({ error: "Could not read prisma/seed.json" }, { status: 500 });
  }

  const [dbFactories, dbLocations, dbItems, dbAsteroidTypes, dbDecompositions, dbBlueprints] =
    await Promise.all([
      prisma.factory.findMany(),
      prisma.location.findMany(),
      prisma.item.findMany(),
      prisma.asteroidType.findMany(),
      prisma.decomposition.findMany({ include: { sourceItem: true } }),
      prisma.blueprint.findMany({ include: { outputItem: true } }),
    ]);

  const dbFactoryNames = new Set(dbFactories.map((f) => f.name));
  const dbLocationNames = new Set(dbLocations.map((l) => l.name));
  const dbItemMap = new Map(dbItems.map((i) => [i.name, i]));
  const dbAsteroidNames = new Set(dbAsteroidTypes.map((a) => a.name));
  const dbDecompSources = new Set(dbDecompositions.map((d) => d.sourceItem.name));
  const dbBlueprintMap = new Map(
    dbBlueprints.map((b) => [`${b.outputItem.name}||${b.factory}`, b])
  );

  // Factories
  const factoriesNew: string[] = [];
  const factoriesExisting: string[] = [];
  for (const name of data.factories) {
    const n = normalizeName(name);
    (dbFactoryNames.has(n) ? factoriesExisting : factoriesNew).push(n);
  }

  // Locations
  const locationsNew: string[] = [];
  const locationsExisting: string[] = [];
  for (const name of data.locations) {
    const n = normalizeName(name);
    (dbLocationNames.has(n) ? locationsExisting : locationsNew).push(n);
  }

  // Items
  const itemsNew: string[] = [];
  const itemsUpdated: string[] = [];
  let itemsUnchanged = 0;
  for (const item of data.items) {
    const n = normalizeName(item.name);
    const existing = dbItemMap.get(n);
    if (!existing) {
      itemsNew.push(n);
    } else if (
      existing.isRawMaterial !== item.isRawMaterial ||
      existing.isFound !== item.isFound ||
      existing.isFinalProduct !== item.isFinalProduct
    ) {
      itemsUpdated.push(n);
    } else {
      itemsUnchanged++;
    }
  }

  // Asteroid types
  const asteroidsNew: string[] = [];
  const asteroidsExisting: string[] = [];
  for (const at of data.asteroidTypes) {
    const n = normalizeName(at.name);
    (dbAsteroidNames.has(n) ? asteroidsExisting : asteroidsNew).push(n);
  }

  // Decompositions
  const decompsNew: string[] = [];
  const decompsExisting: string[] = [];
  for (const d of data.decompositions) {
    const n = normalizeName(d.sourceItem);
    (dbDecompSources.has(n) ? decompsExisting : decompsNew).push(n);
  }

  // Blueprints
  const blueprintsNew: string[] = [];
  const blueprintsUpdated: string[] = [];
  let blueprintsUnchanged = 0;
  for (const bp of data.blueprints) {
    const outName = normalizeName(bp.outputItem);
    const factoryName = normalizeName(bp.factory ?? "");
    const key = `${outName}||${factoryName}`;
    const existing = dbBlueprintMap.get(key);
    const label = factoryName ? `${outName} (${factoryName})` : outName;
    if (!existing) {
      blueprintsNew.push(label);
    } else if (existing.outputQty !== bp.outputQty || existing.isDefault !== bp.isDefault) {
      blueprintsUpdated.push(label);
    } else {
      blueprintsUnchanged++;
    }
  }

  const preview: ImportPreview = {
    factories: { new: factoriesNew, existing: factoriesExisting },
    locations: { new: locationsNew, existing: locationsExisting },
    items: { new: itemsNew, updated: itemsUpdated, unchanged: itemsUnchanged },
    asteroidTypes: { new: asteroidsNew, existing: asteroidsExisting },
    decompositions: { new: decompsNew, existing: decompsExisting },
    blueprints: { new: blueprintsNew, updated: blueprintsUpdated, unchanged: blueprintsUnchanged },
  };

  return NextResponse.json(preview);
}
