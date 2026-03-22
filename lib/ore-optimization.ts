import type { DecompositionResult } from "./calculator";

const EPSILON = 0.0001;

export interface OreWithPico {
  d: DecompositionResult;
  trips: number;
  totalVolume: number;
  pico: number;   // volume remaining in partial last trip (0 = all trips are full)
  spare: number;  // spare volume in last trip
}

export interface OreAdjustment {
  ore: OreWithPico;
  extraUnits: number;
  newTotal: number;
  fitsInSpare: boolean;
  extraTrips: number;
}

export interface OreSubstitution {
  target: OreWithPico;
  adjustments: OreAdjustment[];
  allFitInSpare: boolean;
}

export function computeOreSubstitution(
  decomps: DecompositionResult[],
  cargoCapacity: number,
  toMineMap?: Map<string, number>
): OreSubstitution | null {
  if (!cargoCapacity || decomps.length < 2) return null;

  const ores: OreWithPico[] = decomps.map((d) => {
    const unitsToMine = toMineMap?.get(d.sourceItemId) ?? d.unitsToDecompose;
    const totalVolume = unitsToMine * d.volumePerUnit;
    const pico = totalVolume % cargoCapacity;
    return {
      d,
      totalVolume,
      trips: Math.ceil(totalVolume / cargoCapacity),
      pico,
      spare: pico < EPSILON ? 0 : cargoCapacity - pico,
    };
  });

  const withPico = ores.filter((o) => o.pico > 0);
  if (withPico.length === 0) return null;
  const candidates = [...withPico].sort((a, b) => a.pico - b.pico);

  for (const target of candidates) {
    const others = ores.filter((o) => o.d.sourceItemId !== target.d.sourceItemId);

    const remaining = new Map<string, number>();
    for (const out of target.d.outputs) {
      remaining.set(out.itemId, out.quantityObtained);
    }

    const materials = [...target.d.outputs].sort((a, b) => {
      const countA = others.filter((o) => o.d.outputs.some((x) => x.itemId === a.itemId)).length;
      const countB = others.filter((o) => o.d.outputs.some((x) => x.itemId === b.itemId)).length;
      return countA - countB;
    });

    const extraPerOre = new Map<string, number>();
    let feasible = true;

    for (const mat of materials) {
      const needed = remaining.get(mat.itemId) ?? 0;
      if (needed <= 0) continue;

      const providers = others.filter((o) => o.d.outputs.some((x) => x.itemId === mat.itemId));
      if (providers.length === 0) { feasible = false; break; }

      const best = providers.reduce((b, o) => {
        if (o.d.unitsToDecompose <= 0) return b;
        if (b.d.unitsToDecompose <= 0) return o;
        const rateO = o.d.outputs.find((x) => x.itemId === mat.itemId)!.quantityObtained / o.d.unitsToDecompose;
        const rateB = b.d.outputs.find((x) => x.itemId === mat.itemId)!.quantityObtained / b.d.unitsToDecompose;
        return rateO > rateB ? o : b;
      });

      if (best.d.unitsToDecompose <= 0) { feasible = false; break; }
      const rate = best.d.outputs.find((x) => x.itemId === mat.itemId)!.quantityObtained / best.d.unitsToDecompose;
      const extraRaw = Math.ceil(needed / rate);
      const extra = Math.ceil(extraRaw / best.d.inputQty) * best.d.inputQty;

      extraPerOre.set(best.d.sourceItemId, (extraPerOre.get(best.d.sourceItemId) ?? 0) + extra);

      for (const byproduct of best.d.outputs) {
        if (!remaining.has(byproduct.itemId)) continue;
        const byproductRate = byproduct.quantityObtained / best.d.unitsToDecompose;
        const produced = byproductRate * extra;
        const newNeed = (remaining.get(byproduct.itemId) ?? 0) - produced;
        if (newNeed <= 0) remaining.delete(byproduct.itemId);
        else remaining.set(byproduct.itemId, newNeed);
      }
    }

    if (!feasible) continue;

    const adjustments: OreAdjustment[] = Array.from(extraPerOre.entries()).map(([oreId, extraUnits]) => {
      const ore = ores.find((o) => o.d.sourceItemId === oreId)!;
      const extraVolume = extraUnits * ore.d.volumePerUnit;
      const fitsInSpare = extraVolume <= ore.spare + EPSILON;
      const overSpare = Math.max(0, extraVolume - ore.spare);
      const extraTrips = fitsInSpare ? 0 : Math.ceil(overSpare / cargoCapacity);
      return { ore, extraUnits, newTotal: ore.d.unitsToDecompose + extraUnits, fitsInSpare, extraTrips };
    });

    const totalExtraTrips = adjustments.reduce((s, a) => s + a.extraTrips, 0);
    if (target.trips - totalExtraTrips <= 0) continue;

    return { target, adjustments, allFitInSpare: adjustments.every((a) => a.fitsInSpare) };
  }

  return null;
}
