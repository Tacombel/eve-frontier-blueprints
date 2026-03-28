"use client";

import { useEffect, useState, useCallback } from "react";
import BlueprintCalculation from "@/components/blueprints/BlueprintCalculation";
import SsuAddressBar from "@/components/common/SsuAddressBar";
import { useSsuAddress } from "@/hooks/useSsuAddress";

interface Item { id: string; name: string; isRawMaterial: boolean }
interface BlueprintInput { id: string; itemId: string; quantity: number; item: Item }
interface Blueprint {
  id: string;
  outputQty: number;
  factory: string;
  isDefault: boolean;
  outputItem: Item;
  inputs: BlueprintInput[];
}

type GroupedBlueprints = { item: Item; blueprints: Blueprint[] }[];

export default function BlueprintPacksTab() {
  const { address: ssuAddress, saveAddress } = useSsuAddress();
  const [grouped, setGrouped] = useState<GroupedBlueprints>([]);
  const [factories, setFactories] = useState<{id: string; name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [calcItemId, setCalcItemId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterFactory, setFilterFactory] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [ignoreSsu, setIgnoreSsu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [bpRes, factoriesRes] = await Promise.all([fetch("/api/blueprints"), fetch("/api/factories")]);
    const blueprints: Blueprint[] = await bpRes.json();
    const factoriesList: {id: string; name: string}[] = await factoriesRes.json();
    setFactories(factoriesList);

    const map = new Map<string, { item: Item; blueprints: Blueprint[] }>();
    for (const bp of blueprints) {
      const key = bp.outputItem.id;
      if (!map.has(key)) map.set(key, { item: bp.outputItem, blueprints: [] });
      map.get(key)!.blueprints.push(bp);
    }
    setGrouped(Array.from(map.values()));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(itemId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) { next.delete(itemId); } else { next.add(itemId); }
      return next;
    });
  }

  function toggleCalc(itemId: string) {
    setCalcItemId((prev) => (prev === itemId ? null : itemId));
  }

  async function setDefault(id: string) {
    await fetch(`/api/blueprints/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    load();
  }

  const searchFiltered = grouped.filter(({ item, blueprints }) => {
    if (filterFactory && !blueprints.some((bp) => bp.factory === filterFactory)) return false;
    if (!search.trim()) return true;
    return item.name.toLowerCase().includes(search.trim().toLowerCase());
  });
  const filteredGrouped = calcItemId
    ? searchFiltered.filter(({ item }) => item.id === calcItemId)
    : searchFiltered;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Blueprints</h2>
          <p className="text-xs text-gray-500 mt-1">
            {loading ? "Loading…" : `${filteredGrouped.length} of ${grouped.length} items`}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            placeholder="Search blueprints…"
            className="input w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">✕</button>}
        </div>
        <select
          className="input w-48"
          value={filterFactory}
          onChange={(e) => setFilterFactory(e.target.value)}
        >
          <option value="">All factories</option>
          {factories.map((f) => (
            <option key={f.id} value={f.name}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* SSU Address Bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <SsuAddressBar
            address={ssuAddress}
            onSave={saveAddress}
            onRefresh={() => calcItemId && setRefreshKey(k => k + 1)}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer shrink-0">
          <span>Ignore SSU</span>
          <button
            type="button"
            onClick={() => setIgnoreSsu(!ignoreSsu)}
            title={ignoreSsu ? "Click to use SSU" : "Click to ignore SSU"}
            className={`relative inline-flex h-4 w-8 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              ignoreSsu ? "bg-gray-600" : "bg-cyan-600"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ${
                ignoreSsu ? "translate-x-0" : "translate-x-4"
              }`}
            />
          </button>
        </label>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : grouped.length === 0 ? (
        <p className="text-gray-500">No blueprints available.</p>
      ) : (
        <div className="space-y-3">
          {filteredGrouped.length === 0 && (
            <p className="text-gray-500">No blueprints match &quot;{search}&quot;.</p>
          )}
          {filteredGrouped.map(({ item, blueprints }) => (
            <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-900">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="text-gray-500 hover:text-gray-300 text-xs w-4"
                >
                  {expanded.has(item.id) ? "▼" : "▶"}
                </button>
                <span className="flex-1 font-semibold text-gray-100">{item.name}</span>
                <span className="text-xs text-gray-600">{blueprints.length} blueprint{blueprints.length > 1 ? "s" : ""}</span>
                <button
                  onClick={() => toggleCalc(item.id)}
                  className={`btn-sm text-xs ${calcItemId === item.id ? "bg-cyan-800 hover:bg-cyan-700 text-cyan-100" : ""}`}
                  title="Calculate materials needed"
                >
                  {calcItemId === item.id ? "✕ Close" : "⚡ Calculate"}
                </button>
              </div>

              {calcItemId === item.id && (
                <div className="px-4 py-4 border-b border-gray-800 bg-gray-900/50">
                  <BlueprintCalculation itemId={item.id} itemName={item.name} refreshKey={refreshKey} ignoreSsu={ignoreSsu} />
                </div>
              )}

              {expanded.has(item.id) && (
                <div className="divide-y divide-gray-800/50">
                  {blueprints.map((bp) => (
                    <div key={bp.id} className="px-4 py-3">
                      <div className="flex items-center gap-3 mb-2">
                        <button
                          onClick={() => !bp.isDefault && setDefault(bp.id)}
                          title={bp.isDefault ? "Default blueprint" : "Set as default"}
                          className={`text-base leading-none ${bp.isDefault ? "text-yellow-400" : "text-gray-700 hover:text-yellow-600"}`}
                        >
                          ★
                        </button>
                        <span className="font-medium text-gray-200 flex-1">
                          {bp.factory || <span className="text-gray-500 italic">No factory</span>}
                        </span>
                        {bp.isDefault && (
                          <span className="badge badge-yellow text-xs">Default</span>
                        )}
                        <span className="text-xs text-gray-500">×{bp.outputQty}/run</span>
                      </div>

                      {bp.inputs.length > 0 && (
                        <table className="w-full text-xs ml-6">
                          <tbody>
                            {bp.inputs.map((inp) => (
                              <tr key={inp.id} className="border-t border-gray-800/30">
                                <td className="py-0.5 pr-4 text-gray-300">{inp.item.name}</td>
                                <td className="py-0.5 pr-4 text-gray-500">×{inp.quantity}</td>
                                <td className="py-0.5">
                                  {inp.item.isRawMaterial
                                    ? <span className="badge badge-yellow">Ore</span>
                                    : <span className="badge badge-blue">Crafted</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
