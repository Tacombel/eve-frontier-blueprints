"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalculationResult } from "@/lib/calculator";
import OreSection from "@/components/common/OreSection";

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function BlueprintCalculation({ itemId, refreshKey = 0, ssuAddresses = [] }: { itemId: string; itemName: string; refreshKey?: number; ssuAddresses?: string[] }) {
  const ssuAddressesRef = useRef(ssuAddresses);
  useEffect(() => { ssuAddressesRef.current = ssuAddresses; }, [ssuAddresses]);

  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [excludedOreIds, setExcludedOreIds] = useState<Set<string>>(new Set());
  const excludedOreIdsRef = useRef<Set<string>>(new Set());
  const [excludedOreNames, setExcludedOreNames] = useState<Map<string, string>>(new Map());
  const [cargoCapacity, setCargoCapacity] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("cargoVolume") ?? 0);
  });
  const [miningRate, setMiningRate] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("miningRate") ?? 0);
  });

  function updateCargoCapacity(value: number) {
    setCargoCapacity(value);
    if (value > 0) localStorage.setItem("cargoVolume", String(value));
    else localStorage.removeItem("cargoVolume");
  }

  function updateMiningRate(value: number) {
    setMiningRate(value);
    if (value > 0) localStorage.setItem("miningRate", String(value));
    else localStorage.removeItem("miningRate");
  }

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
    const excluded = [...excludedOreIdsRef.current].join(",");
    const addrs = ssuAddressesRef.current.join(",");
    const url = `/api/calculate?itemId=${itemId}&units=${qty}${excluded ? `&excludedOres=${excluded}` : ""}${addrs ? `&ssuAddresses=${encodeURIComponent(addrs)}` : ""}`;
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setResult(data);
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
  useEffect(() => { if (result !== null && refreshKey > 0) load(true); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (result !== null) load(true); }, [ssuAddresses]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    quantityRef.current = quantity;
    if (result === null) return;
    const t = setTimeout(() => load(true), 400);
    return () => clearTimeout(t);
  }, [quantity]); // eslint-disable-line react-hooks/exhaustive-deps

  function excludeOre(oreId: string, oreName: string) {
    const next = new Set(excludedOreIdsRef.current);
    next.add(oreId);
    excludedOreIdsRef.current = next;
    setExcludedOreIds(next);
    setExcludedOreNames((m) => new Map(m).set(oreId, oreName));
    load(true);
  }

  function restoreOre(oreId: string) {
    const next = new Set(excludedOreIdsRef.current);
    next.delete(oreId);
    excludedOreIdsRef.current = next;
    setExcludedOreIds(next);
    setExcludedOreNames((m) => { const n = new Map(m); n.delete(oreId); return n; });
    load(true);
  }

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
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400">Units to produce:</span>
        <input
          type="number"
          min={1}
          className="input w-20 text-right py-0.5 text-xs"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
        />
        {result.totalRunTime > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span>⏱ Process time:</span>
            <span className="font-medium text-cyan-300">{formatDuration(result.totalRunTime)}</span>
            <span
              className="cursor-help text-gray-600 hover:text-gray-400"
              title="Assumes sequential processing. Having multiple facilities running in parallel would reduce this time."
            >?</span>
          </span>
        )}
        {miningRate > 0 && (() => {
          const totalVolume = (result.decompositions ?? [])
            .filter(d => !d.isUnrefined && !d.sourceIsFound)
            .reduce((sum, d) => sum + Math.max(0, d.unitsToDecompose - d.actualStock) * d.volumePerUnit, 0);
          if (totalVolume <= 0) return null;
          return (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span>⛏ Mining time:</span>
              <span className="font-medium text-cyan-300">{formatDuration(totalVolume / miningRate)}</span>
            </span>
          );
        })()}
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
                <th className="text-right pb-1 pr-2">To Craft (runs)</th>
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
                  <td className="py-1 pr-4 text-right text-gray-300 font-medium">{row.actualStock}</td>
                  <td className="py-1 pr-2 text-right font-semibold">
                    <span className="text-yellow-400">
                      {row.outputQty * row.blueprintRuns}{" "}
                      <span className="text-cyan-400">({row.blueprintRuns}×)</span>
                    </span>
                  </td>
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
                <tr key={row.itemId} className="border-b border-gray-800/40">
                  <td className="py-1 pr-4 text-gray-200">
                    <span>{row.itemName}</span>
                    {row.factory && <span className="badge badge-blue ml-1.5">{row.factory}</span>}
                  </td>
                  <td className="py-1 pr-4 text-right text-gray-400">{row.totalNeeded}</td>
                  <td className="py-1 pr-4 text-right text-gray-300 font-medium">{row.actualStock}</td>
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

      {/* Raw materials needed */}
      {result.rawMaterials.length > 0 && (
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
                <th className="text-right pb-1">To Buy/Refine</th>
              </tr>
            </thead>
            <tbody>
              {result.rawMaterials.map((row) => (
                <tr key={row.itemId} className="border-b border-gray-800/40">
                  <td className="py-1 pr-4 text-gray-200">
                    {row.itemName}
                    {row.isLoot && <span className="badge badge-loot ml-1.5">Loot</span>}
                  </td>
                  <td className="py-1 pr-4 text-right text-gray-400">{row.totalNeeded}</td>
                  <td className="py-1 pr-4 text-right text-gray-300 font-medium">{row.actualStock}</td>
                  <td className={`py-1 text-right font-semibold ${row.toBuy > 0 ? "text-red-400" : "text-green-400"}`}>
                    {row.toBuy > 0 ? row.toBuy : "✓"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Excluded ores banner */}
      {excludedOreIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-gray-700 bg-gray-800/40 px-3 py-2">
          <span className="text-xs text-gray-500">Excluded:</span>
          {[...excludedOreIds].map((id) => (
            <span key={id} className="flex items-center gap-1 rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
              {excludedOreNames.get(id) ?? id}
              <button
                onClick={() => restoreOre(id)}
                className="ml-0.5 text-gray-400 hover:text-white"
                title="Restore"
              >×</button>
            </span>
          ))}
        </div>
      )}

      {(result.warnings ?? []).length > 0 && (
        <div className="rounded-md border border-red-700 bg-red-900/20 px-3 py-2 space-y-1">
          <p className="text-red-400 text-xs font-semibold">⚠ Some materials have no ore source (all sources excluded):</p>
          {result.warnings!.map((w) => (
            <p key={w.materialId} className="text-xs text-red-300">
              <span className="font-medium">{w.materialName}</span>
              <span className="text-red-500"> — excluded: {w.excludedSources.join(", ")}</span>
            </p>
          ))}
        </div>
      )}

      {/* Ore section */}
      <OreSection
        decomps={result.decompositions ?? []}
        directOres={[]}
        neededIds={new Set([
          ...result.rawMaterials.filter((r) => r.toBuy > 0).map((r) => r.itemId),
          ...(result.decompositions ?? [])
            .filter((d) => !d.isUnrefined && d.sourceIsFound && (d.unitsToDecompose + (d.directNeed ?? 0)) > d.actualStock)
            .map((d) => d.sourceItemId),
        ])}
        cargoCapacity={cargoCapacity}
        onCargoChange={updateCargoCapacity}
        miningRate={miningRate}
        onMiningRateChange={updateMiningRate}
        onExcludeOre={excludeOre}
      />

      {result.rawMaterials.length === 0 && result.intermediates.length === 0 && (
        <p className="text-gray-500 text-sm">Nothing to calculate.</p>
      )}
    </div>
  );
}
