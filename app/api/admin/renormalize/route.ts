import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";

type Stats = { renamed: number; duplicatesRemoved: number };

async function renormalizeItems(): Promise<Stats> {
  const items = await prisma.item.findMany();
  let renamed = 0, duplicatesRemoved = 0;
  for (const item of items) {
    const correct = normalizeName(item.name);
    if (correct === item.name) continue;
    const conflict = await prisma.item.findFirst({ where: { name: correct, NOT: { id: item.id } } });
    if (conflict) {
      // Keep the correctly-named one, delete this duplicate
      await prisma.item.delete({ where: { id: item.id } });
      duplicatesRemoved++;
    } else {
      await prisma.item.update({ where: { id: item.id }, data: { name: correct } });
      renamed++;
    }
  }
  return { renamed, duplicatesRemoved };
}

async function renormalizeFactories(): Promise<Stats> {
  const factories = await prisma.factory.findMany();
  let renamed = 0, duplicatesRemoved = 0;
  for (const f of factories) {
    const correct = normalizeName(f.name);
    if (correct === f.name) continue;
    const conflict = await prisma.factory.findUnique({ where: { name: correct } });
    if (conflict) {
      await prisma.factory.delete({ where: { id: f.id } });
      duplicatesRemoved++;
    } else {
      await prisma.factory.update({ where: { id: f.id }, data: { name: correct } });
      renamed++;
    }
  }
  return { renamed, duplicatesRemoved };
}

async function renormalizeLocations(): Promise<Stats> {
  const locations = await prisma.location.findMany();
  let renamed = 0, duplicatesRemoved = 0;
  for (const l of locations) {
    const correct = normalizeName(l.name);
    if (correct === l.name) continue;
    const conflict = await prisma.location.findUnique({ where: { name: correct } });
    if (conflict) {
      await prisma.location.delete({ where: { id: l.id } });
      duplicatesRemoved++;
    } else {
      await prisma.location.update({ where: { id: l.id }, data: { name: correct } });
      renamed++;
    }
  }
  return { renamed, duplicatesRemoved };
}

async function renormalizeAsteroidTypes(): Promise<Stats> {
  const asteroids = await prisma.asteroidType.findMany();
  let renamed = 0, duplicatesRemoved = 0;
  for (const a of asteroids) {
    const correct = normalizeName(a.name);
    if (correct === a.name) continue;
    const conflict = await prisma.asteroidType.findUnique({ where: { name: correct } });
    if (conflict) {
      await prisma.asteroidType.delete({ where: { id: a.id } });
      duplicatesRemoved++;
    } else {
      await prisma.asteroidType.update({ where: { id: a.id }, data: { name: correct } });
      renamed++;
    }
  }
  return { renamed, duplicatesRemoved };
}

async function renormalizeBlueprintFactories(): Promise<Stats> {
  const blueprints = await prisma.blueprint.findMany();
  let renamed = 0, duplicatesRemoved = 0;
  for (const b of blueprints) {
    const correct = normalizeName(b.factory);
    if (correct === b.factory) continue;
    // Check if another blueprint for same item already has the correct factory name
    const conflict = await prisma.blueprint.findFirst({
      where: { outputItemId: b.outputItemId, factory: correct, NOT: { id: b.id } },
    });
    if (conflict) {
      await prisma.blueprint.delete({ where: { id: b.id } });
      duplicatesRemoved++;
    } else {
      await prisma.blueprint.update({ where: { id: b.id }, data: { factory: correct } });
      renamed++;
    }
  }
  return { renamed, duplicatesRemoved };
}

export async function POST() {
  try {
    const [items, factories, locations, asteroids, blueprintFactories] = await Promise.all([
      renormalizeItems(),
      renormalizeFactories(),
      renormalizeLocations(),
      renormalizeAsteroidTypes(),
      renormalizeBlueprintFactories(),
    ]);

    const total = {
      renamed: items.renamed + factories.renamed + locations.renamed + asteroids.renamed + blueprintFactories.renamed,
      duplicatesRemoved: items.duplicatesRemoved + factories.duplicatesRemoved + locations.duplicatesRemoved + asteroids.duplicatesRemoved + blueprintFactories.duplicatesRemoved,
    };

    return NextResponse.json({ ok: true, items, factories, locations, asteroids, blueprintFactories, total });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Re-normalize failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
