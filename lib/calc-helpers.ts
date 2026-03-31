import { prisma } from "@/lib/prisma";
import type { CalcItem, CalculationResult } from "@/lib/calculator";

/** Fetch all items from DB mapped to CalcItem shape. Pass stockMap (itemId -> quantity) to include stock. */
export async function fetchCalcItems(stockMap: Map<string, number> = new Map()): Promise<CalcItem[]> {
  const allItems = await prisma.item.findMany({
    include: {
      blueprints: {
        include: { inputs: { select: { itemId: true, quantity: true } } },
        orderBy: { isDefault: "desc" },
      },
      decompositions: {
        include: { outputs: { select: { itemId: true, quantity: true } } },
        orderBy: { isDefault: "desc" },
      },
      decompositionOutputs: {
        include: {
          decomposition: {
            select: { id: true, sourceItemId: true, inputQty: true, refinery: true, isDefault: true },
          },
        },
      },
    },
  });

  return allItems.map((item) => ({
    id: item.id,
    name: item.name,
    isRawMaterial: item.isRawMaterial,
    isFound: item.isFound,
    stock: stockMap.get(item.id) ?? 0,
    volume: item.volume,
    blueprints: item.blueprints.map((bp) => ({
      id: bp.id,
      outputQty: bp.outputQty,
      factory: bp.factory,
      runTime: bp.runTime,
      isDefault: bp.isDefault,
      inputs: bp.inputs,
    })),
    decompositions: item.decompositions.map((d) => ({
      id: d.id,
      refinery: d.refinery,
      inputQty: d.inputQty,
      runTime: d.runTime,
      isDefault: d.isDefault,
      outputs: d.outputs,
    })),
    producedBy: item.decompositionOutputs.map((dOut) => ({
      decompositionId: dOut.decompositionId,
      sourceItemId: dOut.decomposition.sourceItemId,
      inputQty: dOut.decomposition.inputQty,
      outputQty: dOut.quantity,
      refinery: dOut.decomposition.refinery,
      isDefault: dOut.decomposition.isDefault,
    })),
  }));
}

/** Enrich decompositions and direct-ore raw materials with asteroid/location data. */
export async function enrichAsteroids(result: CalculationResult): Promise<void> {
  const directOreIds = result.rawMaterials.filter((r) => r.isRawMaterial && !r.isFound).map((r) => r.itemId);
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

