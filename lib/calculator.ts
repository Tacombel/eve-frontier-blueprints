export interface CalcBlueprint {
  id: string;
  outputQty: number;
  factory: string;
  runTime: number;
  isDefault: boolean;
  inputs: { itemId: string; quantity: number }[];
}

export interface CalcDecomposition {
  id: string;
  refinery: string;
  inputQty: number;
  runTime: number;
  isDefault: boolean;
  outputs: { itemId: string; quantity: number }[];
}

export interface ProducedByDecomposition {
  decompositionId: string;
  sourceItemId: string;
  inputQty: number;    // source units consumed per run
  outputQty: number;   // THIS item produced per run
  refinery: string;
  isDefault: boolean;
}

export interface CalcItem {
  id: string;
  name: string;
  isRawMaterial: boolean;
  isFound: boolean;
  stock: number;
  volume: number;
  blueprints: CalcBlueprint[];
  decompositions: CalcDecomposition[];
  producedBy: ProducedByDecomposition[];  // decompositions where THIS item is an output
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
  isLoot: boolean; // no blueprint, not rawMaterial, not decomp output
  totalNeeded: number;
  actualStock: number;
  inStock: number;
  toBuy: number;
  volume: number;
  asteroids?: AsteroidInfo[];
}

export interface IntermediateResult {
  itemId: string;
  itemName: string;
  totalNeeded: number;
  actualStock: number;
  inStock: number;
  toProduce: number;
  blueprintRuns: number;
  factory: string;
}

export interface DecompositionResult {
  sourceItemId: string;
  sourceItemName: string;
  unitsToDecompose: number;   // units that go into the refinery
  directNeed?: number;         // units needed directly (not decomposed) — consolidated from rawMaterials
  volumePerUnit: number;
  inputQty: number;
  runs: number;
  actualStock: number;
  outputs: { itemId: string; itemName: string; quantityObtained: number }[];
  asteroids?: AsteroidInfo[];
  isUnrefined?: boolean; // True if material is used directly without refining
  sourceIsFound?: boolean; // True if source is a found/looted item (not a mined ore)
}

export interface SecondaryDecompositionResult {
  decompositionId: string;
  sourceItemId: string;
  sourceItemName: string;
  refinery: string;
  unitsNeeded: number;
  inputQty: number;
  runs: number;
  outputs: { itemId: string; itemName: string; quantityProduced: number }[];
}

export interface FinalProductResult {
  itemId: string;
  itemName: string;
  quantityNeeded: number;
  outputQty: number;
  blueprintRuns: number;
  actualStock: number;
  factory?: string;
  ignored?: boolean;
}

export interface CalculationWarning {
  materialId: string;
  materialName: string;
  excludedSources: string[]; // names of excluded ores that could have produced it
}

export interface CalculationResult {
  rawMaterials: RawMaterialResult[];
  intermediates: IntermediateResult[];
  decompositions: DecompositionResult[];
  secondaryDecompositions: SecondaryDecompositionResult[];
  finalProducts: FinalProductResult[];
  warnings?: CalculationWarning[];
}

type ItemMap = Map<string, CalcItem>;
type DemandMap = Map<string, number>;
type StockUsed = Map<string, number>;
type FactoryMap = Map<string, string>;

function pickBlueprint(item: CalcItem): CalcBlueprint | null {
  if (item.blueprints.length === 0) return null;
  return item.blueprints.find((b) => b.isDefault) ?? item.blueprints[0];
}

function pickDecomposition(item: CalcItem): CalcDecomposition | null {
  if (item.decompositions.length === 0) return null;
  return item.decompositions.find((d) => d.isDefault) ?? item.decompositions[0];
}

function pickProducedBy(item: CalcItem): ProducedByDecomposition | null {
  if (item.producedBy.length === 0) return null;
  return item.producedBy.find((p) => p.isDefault) ?? item.producedBy[0];
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
  stockSatisfied: Set<string>,
  secondaryDecompRuns: Map<string, number>
): void {
  if (visiting.has(itemId)) {
    throw new Error(`Circular blueprint dependency on item "${itemId}"`);
  }

  const item = itemMap.get(itemId);
  if (!item) throw new Error(`Item "${itemId}" not found in item map`);

  const blueprint = pickBlueprint(item);

  // Raw/found items are always leaves in the resolve tree — the post-process
  // greedy handles their ore decompositions.
  const producedBy = (item.isRawMaterial || item.isFound) ? null : pickProducedBy(item);

  // Leaf: no production path — accumulate raw demand
  if (!blueprint && !producedBy) {
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

  if (stillNeeded <= 0) {
    stockSatisfied.add(itemId);
    return;
  }

  demand.set(itemId, (demand.get(itemId) ?? 0) + stillNeeded);

  if (blueprint) {
    // ── Blueprint intermediate ────────────────────────────────────────────────
    const runs = Math.ceil(stillNeeded / blueprint.outputQty);
    factoryMap.set(itemId, blueprint.factory);

    visiting.add(itemId);
    for (const input of blueprint.inputs) {
      resolve(input.itemId, input.quantity * runs, itemMap, demand, grossDemand, stockUsed, factoryMap, visiting, stockSatisfied, secondaryDecompRuns);
    }
    visiting.delete(itemId);
  } else {
    // ── Secondary refinery product ────────────────────────────────────────────
    // producedBy is non-null here (leaf case above already returned)
    const runsNeeded = Math.ceil(stillNeeded / producedBy!.outputQty);
    const currentRuns = secondaryDecompRuns.get(producedBy!.decompositionId) ?? 0;
    const additionalRuns = Math.max(0, runsNeeded - currentRuns);

    // Use max-runs: if another output of the same decomposition already committed
    // more runs, reuse them (avoids double-consuming the source item).
    secondaryDecompRuns.set(producedBy!.decompositionId, Math.max(currentRuns, runsNeeded));

    if (additionalRuns > 0) {
      visiting.add(itemId);
      resolve(producedBy!.sourceItemId, additionalRuns * producedBy!.inputQty, itemMap, demand, grossDemand, stockUsed, factoryMap, visiting, stockSatisfied, secondaryDecompRuns);
      visiting.delete(itemId);
    }
  }
}

export function calculate(
  packItems: { itemId: string; quantity: number }[],
  itemMap: ItemMap,
  options?: { excludedOreIds?: Set<string> }
): CalculationResult {
  const demand: DemandMap = new Map();
  const grossDemand: DemandMap = new Map();
  const stockUsed: StockUsed = new Map();
  const factoryMap: FactoryMap = new Map();
  const stockSatisfied: Set<string> = new Set();
  const secondaryDecompRuns: Map<string, number> = new Map();

  for (const pi of packItems) {
    resolve(pi.itemId, pi.quantity, itemMap, demand, grossDemand, stockUsed, factoryMap, new Set(), stockSatisfied, secondaryDecompRuns);
  }

  const rawMaterials: RawMaterialResult[] = [];
  const intermediates: IntermediateResult[] = [];

  for (const [itemId, needed] of demand) {
    const item = itemMap.get(itemId)!;
    const blueprint = pickBlueprint(item);
    const producedBy = item.isFound ? null : pickProducedBy(item);

    // Raw materials are shown in rawMaterials section (including those with producedBy secondary decomps)
    // Also includes leaf nodes that have no blueprint and no producedBy
    if (item.isRawMaterial || item.isFound || (!blueprint && !producedBy)) {
      const gross = grossDemand.get(itemId) ?? needed;
      const inStock = Math.min(item.stock, gross);
      rawMaterials.push({
        itemId,
        itemName: item.name,
        isRawMaterial: item.isRawMaterial,
        isFound: item.isFound,
        isLoot: !item.isRawMaterial && item.blueprints.length === 0 && item.producedBy.length === 0,
        totalNeeded: gross,
        actualStock: item.stock,
        inStock,
        toBuy: Math.max(0, needed - Math.min(item.stock, needed)),
        volume: item.volume,
      });
    } else if (blueprint) {
      // Blueprint intermediate
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
    // Secondary refinery products (items with producedBy but no blueprint) are shown
    // as part of secondaryDecompositions (built below) — no separate entry here.
  }

  // Include intermediates fully satisfied from stock
  for (const itemId of stockSatisfied) {
    if (demand.has(itemId)) continue;
    const item = itemMap.get(itemId)!;
    const blueprint = pickBlueprint(item);
    if (!blueprint) continue;
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

  // ── Secondary decompositions ─────────────────────────────────────────────
  // Build a lookup: decompositionId → { sourceItem, decomp }
  const decompById = new Map<string, { sourceItem: CalcItem; decomp: CalcDecomposition }>();
  for (const item of itemMap.values()) {
    for (const d of item.decompositions) {
      decompById.set(d.id, { sourceItem: item, decomp: d });
    }
  }

  const secondaryDecompositions: SecondaryDecompositionResult[] = [];
  for (const [decompId, runs] of secondaryDecompRuns) {
    const info = decompById.get(decompId);
    if (!info) continue;
    const { sourceItem, decomp } = info;
    secondaryDecompositions.push({
      decompositionId: decompId,
      sourceItemId: sourceItem.id,
      sourceItemName: sourceItem.name,
      refinery: decomp.refinery,
      unitsNeeded: runs * decomp.inputQty,
      inputQty: decomp.inputQty,
      runs,
      outputs: decomp.outputs.map((o) => ({
        itemId: o.itemId,
        itemName: itemMap.get(o.itemId)?.name ?? o.itemId,
        quantityProduced: o.quantity * runs,
      })),
    });
  }
  secondaryDecompositions.sort((a, b) => a.sourceItemName.localeCompare(b.sourceItemName));

  // ── Primary ore decomposition suggestions ────────────────────────────────
  // Full map (all ores, no exclusions) — used to detect blocked materials
  const allDecompByOutput = new Map<string, CalcItem[]>();
  for (const item of itemMap.values()) {
    const dec = pickDecomposition(item);
    if (!dec) continue;
    for (const out of dec.outputs) {
      const list = allDecompByOutput.get(out.itemId) ?? [];
      list.push(item);
      allDecompByOutput.set(out.itemId, list);
    }
  }
  // Filtered map (exclusions applied) — used by greedy
  const decompByOutput = new Map<string, CalcItem[]>();
  for (const item of itemMap.values()) {
    if (options?.excludedOreIds?.has(item.id)) continue;
    const dec = pickDecomposition(item);
    if (!dec) continue;
    for (const out of dec.outputs) {
      const list = decompByOutput.get(out.itemId) ?? [];
      list.push(item);
      decompByOutput.set(out.itemId, list);
    }
  }

  const remaining = new Map<string, number>();
  for (const row of rawMaterials) {
    if (row.toBuy > 0) remaining.set(row.itemId, row.toBuy);
  }


  const decompRuns = new Map<string, number>();
  // Track surplus byproducts already committed by prior greedy steps
  const surplus = new Map<string, number>();

  // Byproduct coverage: how many remaining items does an item's best-yield source also produce?
  const getBestSourceCoverage = (id: string) => {
    const sources = decompByOutput.get(id) ?? [];
    if (sources.length === 0) return 0;
    const best = sources.reduce((b, s) => {
      const bY = pickDecomposition(b)?.outputs.find((o) => o.itemId === id)?.quantity ?? 0;
      const sY = pickDecomposition(s)?.outputs.find((o) => o.itemId === id)?.quantity ?? 0;
      return sY > bY ? s : b;
    });
    const dec = pickDecomposition(best);
    if (!dec) return 0;
    return dec.outputs.filter((o) => o.itemId !== id && remaining.has(o.itemId)).length;
  };

  while (remaining.size > 0) {
    let matId = "";
    let fewest = Infinity;
    let bestCoverage = -1;
    for (const id of remaining.keys()) {
      const count = (decompByOutput.get(id) ?? []).length;
      if (count === 0) { remaining.delete(id); continue; }
      const coverage = getBestSourceCoverage(id);
      if (count < fewest || (count === fewest && coverage > bestCoverage)) {
        fewest = count; matId = id; bestCoverage = coverage;
      }
    }
    if (!matId || !remaining.has(matId)) break;

    // Apply any surplus already produced for this material
    const available = surplus.get(matId) ?? 0;
    const need = Math.max(0, remaining.get(matId)! - available);
    if (available > 0) surplus.set(matId, Math.max(0, available - remaining.get(matId)!));
    if (need <= 0) { remaining.delete(matId); continue; }

    const sources = decompByOutput.get(matId)!;

    const source = sources.reduce((best, s) => {
      const bYield = pickDecomposition(best)?.outputs.find((o) => o.itemId === matId)?.quantity ?? 0;
      const sYield = pickDecomposition(s)?.outputs.find((o) => o.itemId === matId)?.quantity ?? 0;
      return sYield > bYield ? s : best;
    });

    const dec = pickDecomposition(source)!;
    const yieldPerRun = dec.outputs.find((o) => o.itemId === matId)?.quantity ?? 0;
    if (yieldPerRun <= 0) { remaining.delete(matId); continue; }
    const runsNeeded = Math.ceil(need / yieldPerRun);

    decompRuns.set(source.id, (decompRuns.get(source.id) ?? 0) + runsNeeded);
    remaining.delete(matId);

    // Deduct the source units consumed from remaining (source item may also be a raw material)
    const unitsConsumed = runsNeeded * dec.inputQty;
    if (remaining.has(source.id)) {
      const newSourceNeed = remaining.get(source.id)! - unitsConsumed;
      if (newSourceNeed <= 0) {
        surplus.set(source.id, (surplus.get(source.id) ?? 0) + Math.abs(newSourceNeed));
        remaining.delete(source.id);
      } else {
        remaining.set(source.id, newSourceNeed);
      }
    }

    for (const out of dec.outputs) {
      if (out.itemId === matId) continue;
      const produced = out.quantity * runsNeeded;
      if (remaining.has(out.itemId)) {
        const newNeed = remaining.get(out.itemId)! - produced;
        if (newNeed <= 0) {
          surplus.set(out.itemId, (surplus.get(out.itemId) ?? 0) + Math.abs(newNeed));
          remaining.delete(out.itemId);
        } else {
          remaining.set(out.itemId, newNeed);
        }
      } else {
        // Track byproducts that may reduce future needs
        surplus.set(out.itemId, (surplus.get(out.itemId) ?? 0) + produced);
      }
    }
  }

  const decompUnits = new Map<string, number>();
  for (const [sourceId, runs] of decompRuns) {
    decompUnits.set(sourceId, runs * pickDecomposition(itemMap.get(sourceId)!)!.inputQty);
  }

  const decompositions: DecompositionResult[] = [];
  const includedDecomps = new Set<string>();

  for (const [sourceItemId, unitsToDecompose] of decompUnits) {
    const source = itemMap.get(sourceItemId)!;
    const dec = pickDecomposition(source)!;
    const runs = Math.ceil(unitsToDecompose / dec.inputQty);
    decompositions.push({
      sourceItemId,
      sourceItemName: source.name,
      unitsToDecompose,
      volumePerUnit: source.volume,
      inputQty: dec.inputQty,
      runs,
      actualStock: source.stock,
      sourceIsFound: source.isFound,
      outputs: dec.outputs.map((o) => {
        const outItem = itemMap.get(o.itemId);
        return {
          itemId: o.itemId,
          itemName: outItem?.name ?? o.itemId,
          quantityObtained: o.quantity * runs,
        };
      }),
    });
    includedDecomps.add(sourceItemId);
  }

  // Add optional decompositions for raw materials that are used directly but could be decomposed
  // Only applies to true ores (isRawMaterial=true); isFound items (decomposition outputs) are not ores
  for (const row of rawMaterials) {
    if (!row.isRawMaterial) continue; // Skip decomposition outputs and loot
    if (includedDecomps.has(row.itemId)) continue; // Already included
    const source = itemMap.get(row.itemId);
    if (!source) continue;
    const dec = pickDecomposition(source);
    if (!dec) continue; // No decomposition available

    // Mark as unrefined: material is consumed directly without refining
    decompositions.push({
      sourceItemId: row.itemId,
      sourceItemName: row.itemName,
      unitsToDecompose: 0,
      volumePerUnit: source.volume,
      inputQty: dec.inputQty,
      runs: 0,
      actualStock: source.stock,
      isUnrefined: true, // Mark as "consumed without refining"
      outputs: [], // No outputs shown for unrefined materials
    });
  }

  // Consolidate: if an item appears in both rawMaterials and decompositions (as source),
  // absorb its direct need into the decomp entry and remove it from rawMaterials.
  for (const decomp of decompositions) {
    if (decomp.isUnrefined) continue;
    const rawIdx = rawMaterials.findIndex(r => r.itemId === decomp.sourceItemId);
    if (rawIdx === -1) continue;
    const raw = rawMaterials[rawIdx];
    decomp.directNeed = raw.totalNeeded;
    rawMaterials.splice(rawIdx, 1);
  }

  decompositions.sort((a, b) => a.sourceItemName.localeCompare(b.sourceItemName));
  rawMaterials.sort((a, b) => a.itemName.localeCompare(b.itemName));
  intermediates.sort((a, b) => a.itemName.localeCompare(b.itemName));

  // Detect materials blocked by exclusions (have ore sources, but all are excluded)
  const warnings: CalculationWarning[] = [];
  if (options?.excludedOreIds?.size) {
    for (const row of rawMaterials) {
      if (row.toBuy <= 0) continue;
      const allSources = allDecompByOutput.get(row.itemId) ?? [];
      const availableSources = decompByOutput.get(row.itemId) ?? [];
      if (allSources.length > 0 && availableSources.length === 0) {
        warnings.push({
          materialId: row.itemId,
          materialName: row.itemName,
          excludedSources: allSources
            .filter((s) => options.excludedOreIds!.has(s.id))
            .map((s) => s.name),
        });
      }
    }
  }

  return { rawMaterials, intermediates, decompositions, secondaryDecompositions, finalProducts: [], warnings: warnings.length ? warnings : undefined };
}

export function buildItemMap(items: CalcItem[]): ItemMap {
  return new Map(items.map((i) => [i.id, i]));
}
