export interface CalcBlueprint {
  id: string;
  outputQty: number;
  factory: string;
  isDefault: boolean;
  inputs: { itemId: string; quantity: number }[];
}

export interface CalcDecomposition {
  inputQty: number;
  outputs: { itemId: string; quantity: number }[];
}

export interface CalcItem {
  id: string;
  name: string;
  isRawMaterial: boolean;
  isFound: boolean;
  stock: number;
  volume: number;
  blueprints: CalcBlueprint[];
  decomposition: CalcDecomposition | null;
}

export interface AsteroidInfo {
  name: string;
  locations: string[];
}

export interface RawMaterialResult {
  itemId: string;
  itemName: string;
  isRawMaterial: boolean;
  isFound: boolean;
  totalNeeded: number;
  actualStock: number;
  inStock: number;      // amount consumed from stock
  toBuy: number;
  asteroids?: AsteroidInfo[];
}

export interface IntermediateResult {
  itemId: string;
  itemName: string;
  totalNeeded: number;
  actualStock: number;
  inStock: number;      // amount consumed from stock
  toProduce: number;
  blueprintRuns: number;
  factory: string;
}

export interface DecompositionResult {
  sourceItemId: string;
  sourceItemName: string;
  unitsToDecompose: number;
  volumePerUnit: number;
  inputQty: number;      // units per decomposition run
  runs: number;
  actualStock: number;
  outputs: { itemId: string; itemName: string; quantityObtained: number }[];
  asteroids?: AsteroidInfo[];
}

export interface FinalProductResult {
  itemId: string;
  itemName: string;
  quantityNeeded: number;
  actualStock: number;
  factory?: string;
  ignored?: boolean;
}

export interface CalculationResult {
  rawMaterials: RawMaterialResult[];
  intermediates: IntermediateResult[];
  decompositions: DecompositionResult[];
  finalProducts: FinalProductResult[];
}

type ItemMap = Map<string, CalcItem>;
type DemandMap = Map<string, number>;
type StockUsed = Map<string, number>;
type FactoryMap = Map<string, string>;

function pickBlueprint(item: CalcItem): CalcBlueprint | null {
  if (item.blueprints.length === 0) return null;
  return item.blueprints.find((b) => b.isDefault) ?? item.blueprints[0];
}

function resolve(
  itemId: string,
  quantityNeeded: number,
  itemMap: ItemMap,
  demand: DemandMap,
  grossDemand: DemandMap,
  stockUsed: StockUsed,
  factoryMap: FactoryMap,
  visiting: Set<string>,
  stockSatisfied: Set<string>
): void {
  if (visiting.has(itemId)) {
    throw new Error(`Circular blueprint dependency on item "${itemId}"`);
  }

  const item = itemMap.get(itemId);
  if (!item) throw new Error(`Item "${itemId}" not found in item map`);

  const blueprint = pickBlueprint(item);

  // Base case: raw material, found item, or no blueprint — accumulate raw demand
  if (item.isRawMaterial || item.isFound || !blueprint) {
    demand.set(itemId, (demand.get(itemId) ?? 0) + quantityNeeded);
    grossDemand.set(itemId, (grossDemand.get(itemId) ?? 0) + quantityNeeded);
    return;
  }

  // Track gross demand before stock deduction
  grossDemand.set(itemId, (grossDemand.get(itemId) ?? 0) + quantityNeeded);

  // Apply stock before expanding
  const alreadyUsed = stockUsed.get(itemId) ?? 0;
  const available = Math.max(0, item.stock - alreadyUsed);
  const fromStock = Math.min(available, quantityNeeded);
  const stillNeeded = quantityNeeded - fromStock;

  stockUsed.set(itemId, alreadyUsed + fromStock);
  factoryMap.set(itemId, blueprint.factory);

  if (stillNeeded <= 0) {
    // Fully covered by stock — track for display so the user can edit stock
    stockSatisfied.add(itemId);
    return;
  }

  const runs = Math.ceil(stillNeeded / blueprint.outputQty);
  demand.set(itemId, (demand.get(itemId) ?? 0) + stillNeeded);
  factoryMap.set(itemId, blueprint.factory);

  visiting.add(itemId);
  for (const input of blueprint.inputs) {
    resolve(input.itemId, input.quantity * runs, itemMap, demand, grossDemand, stockUsed, factoryMap, visiting, stockSatisfied);
  }
  visiting.delete(itemId);
}

export function calculate(
  packItems: { itemId: string; quantity: number }[],
  itemMap: ItemMap
): CalculationResult {
  const demand: DemandMap = new Map();
  const grossDemand: DemandMap = new Map();
  const stockUsed: StockUsed = new Map();
  const factoryMap: FactoryMap = new Map();
  const stockSatisfied: Set<string> = new Set();

  for (const pi of packItems) {
    resolve(pi.itemId, pi.quantity, itemMap, demand, grossDemand, stockUsed, factoryMap, new Set(), stockSatisfied);
  }

  const rawMaterials: RawMaterialResult[] = [];
  const intermediates: IntermediateResult[] = [];

  for (const [itemId, needed] of demand) {
    const item = itemMap.get(itemId)!;
    const blueprint = pickBlueprint(item);

    if (item.isRawMaterial || item.isFound || !blueprint) {
      const gross = grossDemand.get(itemId) ?? needed;
      const inStock = Math.min(item.stock, gross);
      rawMaterials.push({
        itemId,
        itemName: item.name,
        isRawMaterial: item.isRawMaterial,
        isFound: item.isFound,
        totalNeeded: gross,
        actualStock: item.stock,
        inStock,
        toBuy: Math.max(0, needed - Math.min(item.stock, needed)),
      });
    } else {
      const inStock = stockUsed.get(itemId) ?? 0;
      const runs = Math.ceil(needed / blueprint.outputQty);
      intermediates.push({
        itemId,
        itemName: item.name,
        totalNeeded: grossDemand.get(itemId) ?? needed,
        actualStock: item.stock,
        inStock,
        toProduce: needed,
        blueprintRuns: runs,
        factory: factoryMap.get(itemId) ?? blueprint.factory,
      });
    }
  }

  // Include intermediates fully satisfied from stock (not in demand) so the user can edit their stock
  for (const itemId of stockSatisfied) {
    if (demand.has(itemId)) continue; // already in intermediates above
    const item = itemMap.get(itemId)!;
    const blueprint = pickBlueprint(item)!;
    const inStock = stockUsed.get(itemId) ?? 0;
    intermediates.push({
      itemId,
      itemName: item.name,
      totalNeeded: grossDemand.get(itemId) ?? inStock,
      actualStock: item.stock,
      inStock,
      toProduce: 0,
      blueprintRuns: 0,
      factory: factoryMap.get(itemId) ?? blueprint.factory,
    });
  }

  // --- Decomposition suggestions ---
  // For each raw material that needs to be bought (toBuy > 0), check if any
  // item in the map has a decomposition that produces it.
  // Build an index: outputItemId → [sourceItem]
  const decompByOutput = new Map<string, CalcItem[]>();
  for (const item of itemMap.values()) {
    if (!item.decomposition) continue;
    for (const out of item.decomposition.outputs) {
      const list = decompByOutput.get(out.itemId) ?? [];
      list.push(item);
      decompByOutput.set(out.itemId, list);
    }
  }

  // Greedy iterative decomposition suggestion:
  // Process the most-constrained material first (fewest ore sources),
  // assign runs, subtract production from all remaining needs, repeat.
  const remaining = new Map<string, number>();
  for (const row of rawMaterials) {
    if (row.toBuy > 0) remaining.set(row.itemId, row.toBuy);
  }

  const decompRuns = new Map<string, number>(); // sourceItemId → runs

  while (remaining.size > 0) {
    // Find the material with the fewest ore sources (most constrained)
    let matId = "";
    let fewest = Infinity;
    for (const id of remaining.keys()) {
      const count = (decompByOutput.get(id) ?? []).length;
      if (count === 0) { remaining.delete(id); continue; }
      if (count < fewest) { fewest = count; matId = id; }
    }
    if (!matId || !remaining.has(matId)) break;

    const need = remaining.get(matId)!;
    const sources = decompByOutput.get(matId)!;

    // Pick the ore with the highest yield for this material
    const source = sources.reduce((best, s) => {
      const bYield = best.decomposition?.outputs.find((o) => o.itemId === matId)?.quantity ?? 0;
      const sYield = s.decomposition?.outputs.find((o) => o.itemId === matId)?.quantity ?? 0;
      return sYield > bYield ? s : best;
    });

    const dec = source.decomposition!;
    const yieldPerRun = dec.outputs.find((o) => o.itemId === matId)?.quantity ?? 0;
    if (yieldPerRun <= 0) { remaining.delete(matId); continue; }
    const runsNeeded = Math.ceil(need / yieldPerRun);

    decompRuns.set(source.id, (decompRuns.get(source.id) ?? 0) + runsNeeded);

    // Subtract this ore's full production from all remaining needs
    for (const out of dec.outputs) {
      if (remaining.has(out.itemId)) {
        const newNeed = remaining.get(out.itemId)! - out.quantity * runsNeeded;
        if (newNeed <= 0) remaining.delete(out.itemId);
        else remaining.set(out.itemId, newNeed);
      }
    }
  }

  const decompUnits = new Map<string, number>();
  for (const [sourceId, runs] of decompRuns) {
    decompUnits.set(sourceId, runs * itemMap.get(sourceId)!.decomposition!.inputQty);
  }

  const decompositions: DecompositionResult[] = [];
  for (const [sourceItemId, unitsToDecompose] of decompUnits) {
    const source = itemMap.get(sourceItemId)!;
    const dec = source.decomposition!;
    const runs = Math.ceil(unitsToDecompose / dec.inputQty);
    decompositions.push({
      sourceItemId,
      sourceItemName: source.name,
      unitsToDecompose,
      volumePerUnit: source.volume,
      inputQty: dec.inputQty,
      runs,
      actualStock: source.stock,
      outputs: dec.outputs.map((o) => {
        const outItem = itemMap.get(o.itemId);
        return {
          itemId: o.itemId,
          itemName: outItem?.name ?? o.itemId,
          quantityObtained: o.quantity * runs,
        };
      }),
    });
  }

  decompositions.sort((a, b) => a.sourceItemName.localeCompare(b.sourceItemName));
  rawMaterials.sort((a, b) => a.itemName.localeCompare(b.itemName));
  intermediates.sort((a, b) => a.itemName.localeCompare(b.itemName));

  return { rawMaterials, intermediates, decompositions, finalProducts: [] };
}

export function buildItemMap(items: CalcItem[]): ItemMap {
  return new Map(items.map((i) => [i.id, i]));
}
