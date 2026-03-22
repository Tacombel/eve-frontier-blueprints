import { prisma } from "@/lib/prisma";
import type { CalcItem, CalculationResult } from "@/lib/calculator";

/** Fetch all items from DB mapped to CalcItem shape. Used by all calculate routes. */
export async function fetchCalcItems(): Promise<CalcItem[]> {
  const allItems = await prisma.item.findMany({
    include: {
      stock: true,
      blueprints: {
        include: { inputs: { select: { itemId: true, quantity: true } } },
        orderBy: { isDefault: "desc" },
      },
      decompositions: {
        include: { outputs: { select: { itemId: true, quantity: true } } },
        orderBy: { isDefault: "desc" },
      },
    },
  });

  return allItems.map((item) => ({
    id: item.id,
    name: item.name,
    isRawMaterial: item.isRawMaterial,
    isFound: item.isFound,
    stock: item.stock?.quantity ?? 0,
    volume: item.volume,
    blueprints: item.blueprints.map((bp) => ({
      id: bp.id,
      outputQty: bp.outputQty,
      factory: bp.factory,
      isDefault: bp.isDefault,
      inputs: bp.inputs,
    })),
    decompositions: item.decompositions.map((d) => ({
      id: d.id,
      refinery: d.refinery,
      inputQty: d.inputQty,
      isDefault: d.isDefault,
      outputs: d.outputs,
    })),
  }));
}

/** Enrich decompositions and direct-ore raw materials with asteroid/location data. */
export async function enrichAsteroids(result: CalculationResult): Promise<void> {
  const directOreIds = result.rawMaterials.filter((r) => r.isRawMaterial).map((r) => r.itemId);
  const allOreIds = [...result.decompositions.map((d) => d.sourceItemId), ...directOreIds];
  if (allOreIds.length === 0) return;

  const asteroidData = await prisma.itemAsteroidType.findMany({
    where: { itemId: { in: allOreIds } },
    include: {
      asteroidType: {
        include: { locations: { include: { location: true } } },
      },
    },
  });

  const asteroidsByItem = new Map<string, { name: string; locations: string[] }[]>();
  for (const row of asteroidData) {
    const list = asteroidsByItem.get(row.itemId) ?? [];
    list.push({
      name: row.asteroidType.name,
      locations: row.asteroidType.locations.map((l) => l.location.name),
    });
    asteroidsByItem.set(row.itemId, list);
  }

  for (const d of result.decompositions) {
    const info = asteroidsByItem.get(d.sourceItemId);
    if (info) d.asteroids = info;
  }
  for (const r of result.rawMaterials) {
    if (r.isRawMaterial) {
      const info = asteroidsByItem.get(r.itemId);
      if (info) r.asteroids = info;
    }
  }
}

/**
 * Apply stock deltas to the DB, clamping consumed items to 0 (never go negative).
 * Positive deltas (produced items) use increment; negative deltas read current stock first.
 */
export async function applyStockDeltas(deltas: Map<string, number>): Promise<void> {
  const consumedIds = [...deltas.entries()].filter(([, d]) => d < 0).map(([id]) => id);
  const currentStocks = consumedIds.length > 0
    ? await prisma.stock.findMany({ where: { itemId: { in: consumedIds } } })
    : [];
  const stockMap = new Map(currentStocks.map((s) => [s.itemId, s.quantity]));

  await prisma.$transaction(
    [...deltas.entries()].map(([id, delta]) => {
      if (delta < 0) {
        const newQty = Math.max(0, (stockMap.get(id) ?? 0) + delta);
        return prisma.stock.upsert({
          where: { itemId: id },
          update: { quantity: newQty },
          create: { itemId: id, quantity: 0 },
        });
      }
      return prisma.stock.upsert({
        where: { itemId: id },
        update: { quantity: { increment: delta } },
        create: { itemId: id, quantity: delta },
      });
    })
  );
}

/** Build stock deltas from a calculation result: consume materials, produce final products. */
export function buildStockDeltas(result: CalculationResult): Map<string, number> {
  const deltas = new Map<string, number>();

  for (const r of result.rawMaterials) {
    if (r.inStock > 0) deltas.set(r.itemId, (deltas.get(r.itemId) ?? 0) - r.inStock);
  }
  for (const i of result.intermediates) {
    if (i.inStock > 0) deltas.set(i.itemId, (deltas.get(i.itemId) ?? 0) - i.inStock);
  }
  for (const d of result.decompositions) {
    if (d.unitsToDecompose > 0) {
      deltas.set(d.sourceItemId, (deltas.get(d.sourceItemId) ?? 0) - d.unitsToDecompose);
    }
  }
  for (const fp of result.finalProducts) {
    if (fp.quantityNeeded > 0) {
      deltas.set(fp.itemId, (deltas.get(fp.itemId) ?? 0) + fp.quantityNeeded);
    }
  }

  return deltas;
}
