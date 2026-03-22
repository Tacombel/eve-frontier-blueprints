"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalculationResult, DecompositionResult } from "@/lib/calculator";
import AsteroidTooltip from "@/components/common/AsteroidTooltip";

// --- Ore cargo optimization ---

interface OreWithPico {
  d: DecompositionResult;
  trips: number;
  totalVolume: number;
  pico: number;   // volume remaining in partial last trip (0 = all trips are full)
  spare: number;  // spare volume in last trip
}

interface OreAdjustment {
  ore: OreWithPico;
  extraUnits: number;
  newTotal: number;
  fitsInSpare: boolean;
  extraTrips: number;
}

interface OreSubstitution {
  target: OreWithPico;
  adjustments: OreAdjustment[];
  allFitInSpare: boolean;
}

function computeOreSubstitution(
  decomps: DecompositionResult[],
  cargoCapacity: number
): OreSubstitution | null {
  if (!cargoCapacity || decomps.length < 2) return null;

  const ores: OreWithPico[] = decomps.map((d) => {
    const totalVolume = d.unitsToDecompose * d.volumePerUnit;
    const pico = totalVolume % cargoCapacity;
    return {
      d,
      totalVolume,
      trips: Math.ceil(totalVolume / cargoCapacity),
      pico,
      spare: pico < 0.0001 ? 0 : cargoCapacity - pico,
    };
  });

  // Target: ore with smallest non-zero pico
  const withPico = ores.filter((o) => o.pico > 0);
  if (withPico.length === 0) return null;
  const target = withPico.reduce((min, o) => (o.pico < min.pico ? o : min));

  const others = ores.filter((o) => o.d.sourceItemId !== target.d.sourceItemId);

  // Track how much of each output still needs to be covered
  const remaining = new Map<string, number>();
  for (const out of target.d.outputs) {
    remaining.set(out.itemId, out.quantityObtained);
  }

  // Sort materials by fewest providers first (most constrained)
  const materials = [...target.d.outputs].sort((a, b) => {
    const countA = others.filter((o) => o.d.outputs.some((x) => x.itemId === a.itemId)).length;
    const countB = others.filter((o) => o.d.outputs.some((x) => x.itemId === b.itemId)).length;
    return countA - countB;
  });

  const extraPerOre = new Map<string, number>(); // oreId → extra units

  for (const mat of materials) {
    const needed = remaining.get(mat.itemId) ?? 0;
    if (needed <= 0) continue;

    const providers = others.filter((o) => o.d.outputs.some((x) => x.itemId === mat.itemId));
    if (providers.length === 0) return null; // material can't be substituted

    // Pick provider with highest yield rate for this material
    const best = providers.reduce((b, o) => {
      const rateO = o.d.outputs.find((x) => x.itemId === mat.itemId)!.quantityObtained / o.d.unitsToDecompose;
      const rateB = b.d.outputs.find((x) => x.itemId === mat.itemId)!.quantityObtained / b.d.unitsToDecompose;
      return rateO > rateB ? o : b;
    });

    const rate = best.d.outputs.find((x) => x.itemId === mat.itemId)!.quantityObtained / best.d.unitsToDecompose;
    const extra = Math.ceil(needed / rate);

    extraPerOre.set(best.d.sourceItemId, (extraPerOre.get(best.d.sourceItemId) ?? 0) + extra);

    // Subtract byproducts of these extra units from remaining needs
    for (const byproduct of best.d.outputs) {
      if (!remaining.has(byproduct.itemId)) continue;
      const byproductRate = byproduct.quantityObtained / best.d.unitsToDecompose;
      const produced = byproductRate * extra;
      const newNeed = (remaining.get(byproduct.itemId) ?? 0) - produced;
      if (newNeed <= 0) remaining.delete(byproduct.itemId);
      else remaining.set(byproduct.itemId, newNeed);
    }
  }

  const adjustments: OreAdjustment[] = Array.from(extraPerOre.entries()).map(([oreId, extraUnits]) => {
    const ore = ores.find((o) => o.d.sourceItemId === oreId)!;
    const extraVolume = extraUnits * ore.d.volumePerUnit;
    const fitsInSpare = extraVolume <= ore.spare + 0.0001;
    const overSpare = Math.max(0, extraVolume - ore.spare);
    const extraTrips = fitsInSpare ? 0 : Math.ceil(overSpare / cargoCapacity);
    return { ore, extraUnits, newTotal: ore.d.unitsToDecompose + extraUnits, fitsInSpare, extraTrips };
  });

  return {
    target,
    adjustments,
    allFitInSpare: adjustments.every((a) => a.fitsInSpare),
  };
}

export default function BlueprintCalculation({ itemId, itemName }: { itemId: string; itemName: string }) {
  const [quantity, setQuantity] = useState(1);
  const [pendingQty, setPendingQty] = useState(1);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [cargoCapacity, setCargoCapacity] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("cargoVolume") ?? 0);
  });

  function updateCargoCapacity(value: number) {
    setCargoCapacity(value);
    if (value > 0) localStorage.setItem("cargoVolume", String(value));
    else localStorage.removeItem("cargoVolume");
  }
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const quantityRef = useRef(quantity);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback((isReload = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (isReload) setRecalculating(true);
    else setLoading(true);
    setError("");
    const qty = quantityRef.current;
    fetch(`/api/calculate?itemId=${itemId}&quantity=${qty}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setResult(data);
          const seeded: Record<string, number> = {};
          for (const row of [...data.rawMaterials, ...data.intermediates, ...(data.finalProducts ?? [])]) {
            seeded[row.itemId] = row.actualStock;
          }
          for (const d of data.decompositions ?? []) {
            seeded[d.sourceItemId] = d.actualStock;
          }
          setStock(seeded);
        }
        setLoading(false);
        setRecalculating(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError("Failed to calculate");
        setLoading(false);
        setRecalculating(false);
      });
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  function applyQuantity() {
    quantityRef.current = pendingQty;
    setQuantity(pendingQty);
    load(true);
  }

  async function saveAll() {
    if (!result) return;
    setSaving(true);
    const allRows = [
      ...result.rawMaterials,
      ...result.intermediates,
      ...(result.finalProducts ?? []),
      ...(result.decompositions ?? []).map((d) => ({ itemId: d.sourceItemId, actualStock: d.actualStock })),
    ];
    await Promise.all(
      allRows.map((row) =>
        fetch(`/api/stock/${row.itemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: stock[row.itemId] ?? row.actualStock }),
        })
      )
    );
    setSaving(false);
    load(true);
  }

  async function execute() {
    if (!confirm(`This will consume materials from stock and add ${quantity}× ${itemName}. Continue?`)) return;
    setExecuting(true);
    const res = await fetch("/api/calculate/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, quantity }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Execute failed");
    } else {
      load(true);
    }
    setExecuting(false);
  }

  const allStockRows = result
    ? [
        ...result.rawMaterials,
        ...result.intermediates,
        ...(result.finalProducts ?? []),
        ...(result.decompositions ?? []).map((d) => ({ itemId: d.sourceItemId, actualStock: d.actualStock })),
      ]
    : [];
  const hasChanges = allStockRows.some(
    (row) => (stock[row.itemId] ?? row.actualStock) !== row.actualStock
  );

  if (loading) return <p className="text-gray-500 text-sm">Calculating…</p>;
  if (error) return <p className="text-red-400 text-sm">Error: {error}</p>;
  if (!result) return null;

  const isRecalculating = recalculating;
  const stockSufficient =
    result.intermediates.length === 0 &&
    result.rawMaterials.every((r) => r.toBuy === 0) &&
    (result.decompositions ?? []).length === 0;

  return (
    <div className={`space-y-4 ${isRecalculating ? "opacity-60" : ""}`}>
      {/* Quantity selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Quantity to produce:</span>
        <input
          type="number"
          min={1}
          className="input w-20 text-right py-0.5 text-xs"
          value={pendingQty}
          onChange={(e) => setPendingQty(Math.max(1, Number(e.target.value)))}
          onKeyDown={(e) => e.key === "Enter" && applyQuantity()}
        />
        {pendingQty !== quantity && (
          <button onClick={applyQuantity} className="btn-sm btn-primary">
            Recalculate
          </button>
        )}
      </div>

      {stockSufficient && (
        <div className="flex items-center gap-2 rounded-md bg-green-900/30 border border-green-800 px-3 py-2">
          <span className="text-green-400 text-base">✓</span>
          <span className="text-green-300 text-sm font-medium">Stock sufficient</span>
        </div>
      )}

      {/* Final product */}
      {(result.finalProducts ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-cyan-300 mb-2">Final Product</h3>
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col />
              <col className="w-20" />
              <col className="w-28" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-1 pr-4">Item</th>
                <th className="text-right pb-1 pr-4">Needed</th>
                <th className="text-right pb-1 pr-4">Stock</th>
                <th className="text-right pb-1 pr-2">in stock</th>
              </tr>
            </thead>
            <tbody>
              {result.finalProducts!.map((row) => (
                <tr key={row.itemId} className="border-b border-gray-800/40">
                  <td className="py-1 pr-4 text-gray-200">
                    {row.itemName}
                    {row.factory && <span className="badge badge-blue ml-1.5">{row.factory}</span>}
                  </td>
                  <td className="py-1 pr-4 text-right text-gray-400">{row.quantityNeeded}</td>
                  <td className="py-1 pr-4 text-right">
                    <input
                      type="number"
                      min={0}
                      className={`input w-24 text-right py-0.5 text-xs ${
                        (stock[row.itemId] ?? row.actualStock) !== row.actualStock ? "border-cyan-600" : ""
                      }`}
                      value={stock[row.itemId] ?? row.actualStock}
                      onChange={(e) => setStock((s) => ({ ...s, [row.itemId]: Number(e.target.value) }))}
                    />
                  </td>
                  <td className="py-1 pr-2 text-right text-gray-600 text-xs">in stock</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Intermediates */}
      {result.intermediates.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-2">Intermediate Items to Craft</h3>
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col />
              <col className="w-20" />
              <col className="w-28" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-1 pr-4">Item</th>
                <th className="text-right pb-1 pr-4">Needed</th>
                <th className="text-right pb-1 pr-4">Stock</th>
                <th className="text-right pb-1">To Craft (runs)</th>
              </tr>
            </thead>
            <tbody>
              {result.intermediates.map((row) => (
                <tr key={row.itemId} className={`border-b border-gray-800/40 ${row.toProduce === 0 ? "opacity-50" : ""}`}>
                  <td className={`py-1 pr-4 ${row.toProduce === 0 ? "text-gray-400" : "text-gray-200"}`}>
                    <span>{row.itemName}</span>
                    {row.factory && <span className="badge badge-blue ml-1.5">{row.factory}</span>}
                  </td>
                  <td className="py-1 pr-4 text-right text-gray-400">{row.totalNeeded}</td>
                  <td className="py-1 pr-4 text-right">
                    <input
                      type="number"
                      min={0}
                      className={`input w-24 text-right py-0.5 text-xs ${
                        (stock[row.itemId] ?? row.actualStock) !== row.actualStock ? "border-cyan-600" : ""
                      }`}
                      value={stock[row.itemId] ?? row.actualStock}
                      onChange={(e) => setStock((s) => ({ ...s, [row.itemId]: Number(e.target.value) }))}
                    />
                  </td>
                  <td className="py-1 text-right font-semibold">
                    {row.toProduce === 0
                      ? <span className="text-green-400">✓</span>
                      : <span className="text-yellow-400">{row.toProduce} <span className="text-cyan-400">({row.blueprintRuns}×)</span></span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Raw materials (found/looted only) */}
      {(() => {
        const foundOnly = result.rawMaterials.filter((r) => !r.isRawMaterial);
        return foundOnly.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-yellow-400 mb-2">Raw Materials Needed</h3>
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col />
                <col className="w-20" />
                <col className="w-28" />
                <col className="w-24" />
              </colgroup>
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left pb-1 pr-4">Material</th>
                  <th className="text-right pb-1 pr-4">Needed</th>
                  <th className="text-right pb-1 pr-4">Stock</th>
                  <th className="text-right pb-1">To Buy/Mine</th>
                </tr>
              </thead>
              <tbody>
                {foundOnly.map((row) => (
                  <tr key={row.itemId} className="border-b border-gray-800/40">
                    <td className="py-1 pr-4 text-gray-200">{row.itemName}</td>
                    <td className="py-1 pr-4 text-right text-gray-400">{row.totalNeeded}</td>
                    <td className="py-1 pr-4 text-right">
                      <input
                        type="number"
                        min={0}
                        className={`input w-24 text-right py-0.5 text-xs ${
                          (stock[row.itemId] ?? row.actualStock) !== row.actualStock ? "border-cyan-600" : ""
                        }`}
                        value={stock[row.itemId] ?? row.actualStock}
                        onChange={(e) => setStock((s) => ({ ...s, [row.itemId]: Number(e.target.value) }))}
                      />
                    </td>
                    <td className={`py-1 text-right font-semibold ${row.toBuy > 0 ? "text-red-400" : "text-green-400"}`}>
                      {row.toBuy > 0 ? row.toBuy : "✓"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null;
      })()}

      {/* Ore section */}
      {(() => {
        const directOres = result.rawMaterials.filter((r) => r.isRawMaterial);
        const decomps = result.decompositions ?? [];
        if (decomps.length === 0 && directOres.length === 0) return null;

        const suggestion = computeOreSubstitution(decomps, cargoCapacity);

        // Materials actually needed by the calculation (have pending demand)
        const neededIds = new Set(result.rawMaterials.filter((r) => r.toBuy > 0).map((r) => r.itemId));

        // Compute picos for display
        const picoMap = new Map<string, OreWithPico>();
        if (cargoCapacity > 0) {
          for (const d of decomps) {
            const totalVolume = d.unitsToDecompose * d.volumePerUnit;
            const pico = totalVolume % cargoCapacity;
            picoMap.set(d.sourceItemId, {
              d,
              totalVolume,
              trips: Math.ceil(totalVolume / cargoCapacity),
              pico,
              spare: pico < 0.0001 ? 0 : cargoCapacity - pico,
            });
          }
        }

        return (
          <div>
            {/* Header + cargo capacity input */}
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-sm font-semibold text-purple-400 flex-1">Ore to Decompose</h3>
              <label className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Cargo:</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="m³"
                  className="input w-24 text-right py-0.5 text-xs"
                  value={cargoCapacity || ""}
                  onChange={(e) => updateCargoCapacity(Math.max(0, Number(e.target.value)))}
                />
                <span className="text-gray-600">m³</span>
              </label>
            </div>

            {/* Ore substitution suggestion — shown before the list */}
            {suggestion && (
              <div className={`mb-3 rounded border p-3 text-xs ${
                suggestion.allFitInSpare
                  ? "border-green-800 bg-green-900/20"
                  : "border-yellow-800 bg-yellow-900/20"
              }`}>
                <p className={`font-semibold mb-2 ${suggestion.allFitInSpare ? "text-green-300" : "text-yellow-300"}`}>
                  💡 Trip optimization
                </p>
                <p className="text-gray-400 mb-2">
                  <span className="text-yellow-300">{suggestion.target.d.sourceItemName}</span> only occupies{" "}
                  <span className="font-semibold text-yellow-400">{suggestion.target.pico.toFixed(2)}</span> m³ in its last trip
                  (spare: <span className="font-semibold">{suggestion.target.spare.toFixed(2)}</span> m³).
                  Its materials can be covered by redistributing:
                </p>
                <div className="space-y-1">
                  {suggestion.adjustments.map((adj) => (
                    <div key={adj.ore.d.sourceItemId} className="flex items-center gap-2">
                      <span className="text-gray-300 w-32 truncate">{adj.ore.d.sourceItemName}</span>
                      <span className="text-gray-500">
                        {adj.ore.d.unitsToDecompose} → <span className="text-white font-semibold">{adj.newTotal}</span> u
                      </span>
                      <span className="text-gray-600">(+{adj.extraUnits} u)</span>
                      {adj.fitsInSpare ? (
                        <span className="text-green-400">✓ fits in existing trip</span>
                      ) : (
                        <span className="text-yellow-400">+{adj.extraTrips} extra trip{adj.extraTrips > 1 ? "s" : ""}</span>
                      )}
                    </div>
                  ))}
                </div>
                {suggestion.allFitInSpare && (
                  <p className="mt-2 text-green-400 font-medium">✓ You can skip this ore with no extra trips</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              {decomps.map((d) => {
                const op = picoMap.get(d.sourceItemId);
                const isTarget = suggestion?.target.d.sourceItemId === d.sourceItemId;
                return (
                  <div
                    key={d.sourceItemId}
                    className={`rounded border p-3 ${
                      isTarget
                        ? "border-yellow-700 bg-yellow-900/20"
                        : "border-gray-800 bg-gray-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`relative text-xs font-medium flex-1 ${
                          isTarget ? "text-yellow-300" : "text-gray-200"
                        } ${d.asteroids?.length ? "cursor-help" : ""}`}
                        onMouseEnter={() => d.asteroids?.length && setHoveredItemId(d.sourceItemId)}
                        onMouseLeave={() => setHoveredItemId(null)}
                      >
                        {d.sourceItemName}
                        {isTarget && <span className="ml-1.5 text-yellow-500 text-xs">⚠ candidate</span>}
                        {d.asteroids?.length && <span className="ml-1 text-purple-400 text-xs">🪨</span>}
                        {hoveredItemId === d.sourceItemId && d.asteroids?.length && (
                          <AsteroidTooltip asteroids={d.asteroids} />
                        )}
                      </span>
                      <span className="text-xs text-gray-500">
                        Decompose <span className="text-purple-300 font-semibold">{d.unitsToDecompose}</span> units
                        ({d.runs} run{d.runs > 1 ? "s" : ""} of {d.inputQty})
                      </span>
                      {op && (
                        <span className="text-xs text-gray-600">
                          {op.trips} trip{op.trips > 1 ? "s" : ""}
                          {" · "}<span className="text-gray-500">{op.totalVolume.toFixed(2)} m³</span>
                          {op.pico > 0.0001 && (
                            <span className={`ml-1 ${op.pico <= cargoCapacity * 0.25 ? "text-yellow-500" : "text-gray-500"}`}>
                              · pico <span className="font-semibold">{op.pico.toFixed(2)}</span> m³
                            </span>
                          )}
                        </span>
                      )}
                      <input
                        type="number"
                        min={0}
                        title="Stock"
                        className={`input w-24 text-right py-0.5 text-xs ${
                          (stock[d.sourceItemId] ?? d.actualStock) !== d.actualStock ? "border-cyan-600" : ""
                        }`}
                        value={stock[d.sourceItemId] ?? d.actualStock}
                        onChange={(e) => setStock((s) => ({ ...s, [d.sourceItemId]: Number(e.target.value) }))}
                      />
                      <span className="text-xs text-gray-600">in stock</span>
                      {(() => {
                        const toMine = Math.max(0, d.unitsToDecompose - (stock[d.sourceItemId] ?? d.actualStock));
                        return toMine > 0
                          ? <span className="text-xs font-semibold text-red-400 w-24 text-right">⛏ {toMine}</span>
                          : <span className="text-xs font-semibold text-green-400 w-24 text-right">✓</span>;
                      })()}
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs">
                      <span className="text-gray-600 self-center">→</span>
                      {d.outputs.map((o) => {
                        const needed = neededIds.has(o.itemId);
                        return needed ? (
                          <span key={o.itemId} className="bg-purple-900/60 border border-purple-700 rounded px-1.5 py-0.5 text-purple-200 font-medium">
                            {o.itemName} <span className="text-yellow-400">×{o.quantityObtained}</span>
                          </span>
                        ) : (
                          <span key={o.itemId} className="bg-gray-700 border border-gray-500 rounded px-1.5 py-0.5 text-gray-300">
                            {o.itemName} <span className="text-gray-400">×{o.quantityObtained}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {directOres.map((row) => (
                <div key={row.itemId} className="rounded border border-gray-800 bg-gray-800/40 p-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`relative text-xs font-medium text-gray-200 flex-1 ${row.asteroids?.length ? "cursor-help" : ""}`}
                      onMouseEnter={() => row.asteroids?.length && setHoveredItemId(row.itemId)}
                      onMouseLeave={() => setHoveredItemId(null)}
                    >
                      {row.itemName}
                      {row.asteroids?.length && <span className="ml-1 text-purple-400 text-xs">🪨</span>}
                      {hoveredItemId === row.itemId && row.asteroids?.length && (
                        <AsteroidTooltip asteroids={row.asteroids} />
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      Mine <span className="text-purple-300 font-semibold">{row.totalNeeded}</span> units directly
                    </span>
                    <input
                      type="number"
                      min={0}
                      title="Stock"
                      className={`input w-24 text-right py-0.5 text-xs ${
                        (stock[row.itemId] ?? row.actualStock) !== row.actualStock ? "border-cyan-600" : ""
                      }`}
                      value={stock[row.itemId] ?? row.actualStock}
                      onChange={(e) => setStock((s) => ({ ...s, [row.itemId]: Number(e.target.value) }))}
                    />
                    <span className="text-xs text-gray-600">in stock</span>
                    {(() => {
                      const toMine = Math.max(0, row.totalNeeded - (stock[row.itemId] ?? row.actualStock));
                      return toMine > 0
                        ? <span className="text-xs font-semibold text-red-400 w-24 text-right">⛏ {toMine}</span>
                        : <span className="text-xs font-semibold text-green-400 w-24 text-right">✓</span>;
                    })()}
                  </div>
                </div>
              ))}
            </div>

            {decomps.length > 0 && (
              <div className="mt-2 flex justify-end">
                <span className="text-sm text-gray-400">
                  Total ore to decompose:{" "}
                  <span className="text-purple-300 font-bold">
                    {decomps.reduce((sum, d) => sum + d.unitsToDecompose, 0).toLocaleString()}
                  </span>{" "}
                  units
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {result.rawMaterials.length === 0 && result.intermediates.length === 0 && (
        <p className="text-gray-500 text-sm">Nothing to calculate.</p>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={saveAll}
          disabled={!hasChanges || saving}
          className={`btn-sm ${hasChanges ? "btn-primary" : "opacity-30"}`}
        >
          {saving ? "Saving…" : isRecalculating ? "Recalculating…" : "Update Stock & Recalculate"}
        </button>
        <button
          onClick={execute}
          disabled={executing || saving}
          className="btn-sm bg-green-800 hover:bg-green-700 text-green-100 disabled:opacity-40"
        >
          {executing ? "Executing…" : "⚡ Execute"}
        </button>
      </div>
    </div>
  );
}
