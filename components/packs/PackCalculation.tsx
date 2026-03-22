"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalculationResult } from "@/lib/calculator";
import OreSection from "@/components/common/OreSection";

export default function PackCalculation({ packId }: { packId: string }) {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  // pending stock edits: itemId -> value
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
  const [ignoredItems, setIgnoredItems] = useState<Set<string>>(new Set());
  const ignoredRef = useRef(ignoredItems);

  const load = useCallback((isReload = false) => {
    if (isReload) setRecalculating(true);
    else setLoading(true);
    setError("");
    const ignored = ignoredRef.current;
    const ignoreParam = ignored.size > 0 ? `?ignore=${[...ignored].join(",")}` : "";
    fetch(`/api/packs/${packId}/calculate${ignoreParam}`)
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
      .catch(() => {
        setError("Failed to calculate");
        setLoading(false);
        setRecalculating(false);
      });
  }, [packId]);

  useEffect(() => { load(); }, [load]);

  function toggleIgnore(itemId: string) {
    setIgnoredItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      ignoredRef.current = next;
      return next;
    });
  }

  useEffect(() => {
    if (result !== null) load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ignoredItems]);

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
    if (!confirm("This will update stock: consume materials and add final products. Continue?")) return;
    setExecuting(true);
    const ignoreParam = ignoredItems.size > 0 ? `?ignore=${[...ignoredItems].join(",")}` : "";
    const res = await fetch(`/api/packs/${packId}/execute${ignoreParam}`, { method: "POST" });
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
    <div className={`mt-3 space-y-4 border-t border-gray-800 pt-4 ${isRecalculating ? "opacity-60" : ""}`}>
      {stockSufficient && (
        <div className="flex items-center gap-2 rounded-md bg-green-900/30 border border-green-800 px-3 py-2">
          <span className="text-green-400 text-base">✓</span>
          <span className="text-green-300 text-sm font-medium">Stock sufficient</span>
        </div>
      )}
      {/* Final products stock */}
      {(result.finalProducts ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-cyan-300 mb-2">Final Products</h3>
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col />
              <col className="w-20" />
              <col className="w-28" />
              <col className="w-24" />
              <col className="w-12" />
            </colgroup>
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-1 pr-4">Item</th>
                <th className="text-right pb-1 pr-4">Needed</th>
                <th className="text-right pb-1 pr-4">Stock</th>
                <th className="text-right pb-1 pr-2">To Craft (runs)</th>
                <th className="text-center pb-1" title="Include in this batch">Active</th>
              </tr>
            </thead>
            <tbody>
              {result.finalProducts.map((row) => {
                const ignored = ignoredItems.has(row.itemId);
                return (
                  <tr key={row.itemId} className={`border-b border-gray-800/40 ${ignored ? "opacity-40" : ""}`}>
                    <td className="py-1 pr-4 text-gray-200">
                      {row.itemName}
                      {row.factory && <span className="badge badge-blue ml-1.5">{row.factory}</span>}
                    </td>
                    <td className="py-1 pr-4 text-right text-gray-400">{row.quantityNeeded}</td>
                    <td className="py-1 pr-4 text-right">
                      <input
                        type="number"
                        min={0}
                        disabled={ignored}
                        className={`input w-24 text-right py-0.5 text-xs ${
                          (stock[row.itemId] ?? row.actualStock) !== row.actualStock ? "border-cyan-600" : ""
                        }`}
                        value={stock[row.itemId] ?? row.actualStock}
                        onChange={(e) => setStock((s) => ({ ...s, [row.itemId]: Number(e.target.value) }))}
                      />
                    </td>
                    <td className="py-1 pr-2 text-right font-semibold">
                      {row.blueprintRuns === 0
                        ? <span className="text-green-400">✓</span>
                        : <span className="text-yellow-400">{row.quantityNeeded} <span className="text-cyan-400">({row.blueprintRuns}×)</span></span>}
                    </td>
                    <td className="py-1 text-center">
                      <button
                        type="button"
                        onClick={() => toggleIgnore(row.itemId)}
                        title={ignored ? "Click to include in this batch" : "Click to ignore in this batch"}
                        className={`relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                          ignored ? "bg-gray-600" : "bg-cyan-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ${
                            ignored ? "translate-x-0" : "translate-x-4"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Intermediates + Raw materials — same 4-column layout for alignment */}
      {result.intermediates.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-2">Intermediate Items to Craft</h3>
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col />
              <col className="w-20" />
              <col className="w-28" />
              <col className="w-24" />
              <col className="w-12" />
            </colgroup>
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-1 pr-4">Item</th>
                <th className="text-right pb-1 pr-4">Needed</th>
                <th className="text-right pb-1 pr-4">Stock</th>
                <th className="text-right pb-1">To Craft (runs)</th>
                <th />
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
                  <td />
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
              <col className="w-12" />
            </colgroup>
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-1 pr-4">Material</th>
                <th className="text-right pb-1 pr-4">Needed</th>
                <th className="text-right pb-1 pr-4">Stock</th>
                <th className="text-right pb-1">To Buy/Mine</th>
                <th />
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
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : null;
      })()}

      {/* Ore section */}
      <OreSection
        decomps={result.decompositions ?? []}
        directOres={result.rawMaterials.filter((r) => r.isRawMaterial)}
        neededIds={new Set(result.rawMaterials.filter((r) => r.toBuy > 0).map((r) => r.itemId))}
        cargoCapacity={cargoCapacity}
        onCargoChange={updateCargoCapacity}
        stock={stock}
        onStockChange={(id, v) => setStock((s) => ({ ...s, [id]: v }))}
      />

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
