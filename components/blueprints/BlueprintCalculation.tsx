"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalculationResult } from "@/lib/calculator";
import OreSection from "@/components/common/OreSection";

export default function BlueprintCalculation({ itemId, itemName }: { itemId: string; itemName: string }) {
  const [quantity, setQuantity] = useState(1);
  const [pendingQty, setPendingQty] = useState(1);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
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
    fetch(`/api/calculate?itemId=${itemId}&runs=${qty}`, { signal: controller.signal })
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
    const results = await Promise.allSettled(
      allRows.map((row) =>
        fetch(`/api/stock/${row.itemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: stock[row.itemId] ?? row.actualStock }),
        }).then((r) => { if (!r.ok) throw new Error(`Stock save failed for ${row.itemId}`); })
      )
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setSaving(false);
    if (failed > 0) {
      alert(`${failed} item(s) could not be saved. The rest were updated successfully.`);
    }
    load(true);
  }

  async function execute() {
    if (!confirm(`This will consume materials from stock and add ${quantity} batch${quantity > 1 ? "es" : ""} of ${itemName}. Continue?`)) return;
    setExecuting(true);
    const res = await fetch("/api/calculate/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, runs: quantity }),
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
        <span className="text-xs text-gray-400">Batches to produce:</span>
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
                  <th className="text-right pb-1">To Buy/Refine</th>
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
