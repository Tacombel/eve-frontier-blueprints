"use client";

import { useEffect, useState } from "react";

interface ItemData {
  id: string;
  name: string;
  isRawMaterial: boolean;
  isFound: boolean;
  isFinalProduct: boolean;
  isAsteroid: boolean;
  volume: number;
  blueprints: { id: string; factory: string; outputQty: number; isDefault: boolean }[];
}

interface Blueprint {
  outputItem?: { id: string };
  factory?: string;
}

interface Decomposition {
  sourceItem?: { id: string };
  refinery?: string;
  outputs?: Array<{ itemId: string }>;
}

export default function ItemsPage() {
  const [items, setItems] = useState<ItemData[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [showOre, setShowOre] = useState(false);
  const [oreCount, setOreCount] = useState(0);
  const [showLoot, setShowLoot] = useState(false);
  const [lootCount, setLootCount] = useState(0);
  const [lootIds, setLootIds] = useState<Set<string>>(new Set());
  const [recipesByItem, setRecipesByItem] = useState<Map<string, { factories: string[]; refineries: string[] }>>(new Map());
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [filteredRes, totalRes, decompsRes, bpsRes] = await Promise.all([
      fetch(`/api/items?search=${encodeURIComponent(search)}`),
      fetch("/api/items"),
      fetch("/api/decompositions"),
      fetch("/api/blueprints"),
    ]);
    setItems(await filteredRes.json());
    const allItems = await totalRes.json();
    const decomps = await decompsRes.json();
    const bps = await bpsRes.json();

    const bpOutputIds = new Set<string>(bps.map((b: Blueprint) => b.outputItem?.id).filter((id: string | undefined): id is string => Boolean(id)));

    const decompOutputIds = new Set<string>();
    decomps.forEach((d: Decomposition) => {
      if (d.outputs && Array.isArray(d.outputs)) {
        d.outputs.forEach((o) => decompOutputIds.add(o.itemId));
      }
    });
    const trueLoot = allItems.filter((i: ItemData) =>
      !bpOutputIds.has(i.id) && !i.isRawMaterial && !i.isAsteroid && !decompOutputIds.has(i.id)
    );
    const trueLootIdSet = new Set<string>(trueLoot.map((i: ItemData) => i.id));

    const recipes = new Map<string, { factories: string[]; refineries: string[] }>();
    for (const bp of bps) {
      const itemId = bp.outputItem?.id;
      if (!itemId) continue;
      if (!recipes.has(itemId)) recipes.set(itemId, { factories: [], refineries: [] });
      const factories = recipes.get(itemId)!.factories;
      if (bp.factory && !factories.includes(bp.factory)) {
        factories.push(bp.factory);
      }
    }
    for (const d of decomps) {
      const itemId = d.sourceItem?.id;
      if (!itemId) continue;
      if (d.outputs && Array.isArray(d.outputs)) {
        for (const output of d.outputs) {
          if (!recipes.has(output.itemId)) recipes.set(output.itemId, { factories: [], refineries: [] });
          const refineries = recipes.get(output.itemId)!.refineries;
          if (d.refinery && !refineries.includes(d.refinery)) {
            refineries.push(d.refinery);
          }
        }
      }
    }

    const ores = allItems.filter((i: ItemData) => i.isRawMaterial && !i.isFound && !i.isFinalProduct);

    setTotalItems(allItems.length);
    setOreCount(ores.length);
    setLootCount(trueLoot.length);
    setLootIds(trueLootIdSet);
    setRecipesByItem(recipes);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Items</h1>
          <p className="text-xs text-gray-500 mt-1">
            {loading ? "Loading…" : search ? `${items.length} of ${totalItems} items` : `${totalItems} items`}
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-4 items-end">
        <div className="relative flex-1 max-w-xs">
          <input
            className="input w-full"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">✕</button>}
        </div>
        <button
          onClick={() => setShowOre(!showOre)}
          className={`btn-sm ${showOre ? "bg-yellow-700 hover:bg-yellow-600 text-yellow-100" : ""}`}
          title="Show only mining ores (raw materials)"
        >
          {showOre ? `✓ Ore (${oreCount})` : `Ore (${oreCount})`}
        </button>
        <button
          onClick={() => setShowLoot(!showLoot)}
          className={`btn-sm ${showLoot ? "bg-amber-700 hover:bg-amber-600 text-amber-100" : ""}`}
          title="Show only loot (items without blueprint or decomposition)"
        >
          {showLoot ? `✓ Loot (${lootCount})` : `Loot (${lootCount})`}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">No items found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="pb-2 pr-3">Name</th>
              <th className="pb-2 pr-3">Type</th>
              <th className="pb-2 pr-3 text-right">Volume</th>
              <th className="pb-2 pr-3">Recipes</th>
            </tr>
          </thead>
          <tbody>
            {(showOre ? items.filter(i => i.isRawMaterial && !i.isFound && !i.isFinalProduct) : showLoot ? items.filter(i => lootIds.has(i.id)) : items).map((item) => (
              <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 h-8 align-middle">
                <td className="py-1 pr-3 font-medium text-gray-100 whitespace-nowrap align-middle">{item.name}</td>
                <td className="py-1 pr-3 text-xs whitespace-nowrap overflow-hidden">
                  {item.isRawMaterial && <span className="badge badge-yellow">Ore</span>}
                  {item.isAsteroid && <span className="badge badge-orange">Asteroid</span>}
                  {item.isFound && <span className="badge badge-blue">Raw</span>}
                  {item.blueprints.length > 0 && !item.isFinalProduct && !item.isRawMaterial && !item.isAsteroid && <span className="badge badge-gray">Intermediate</span>}
                  {item.isFinalProduct && <span className="badge badge-cyan">Final</span>}
                  {!item.isRawMaterial && !item.isAsteroid && !item.isFound && !item.isFinalProduct && item.blueprints.length === 0 && <span className="text-gray-600">—</span>}
                </td>
                <td className="py-1 pr-3 text-right text-gray-400 whitespace-nowrap">
                  {item.volume > 0 ? <span>{item.volume} m³</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="py-1 pr-3 text-xs whitespace-nowrap overflow-hidden">
                  {(() => {
                    if (item.isRawMaterial || item.isAsteroid) {
                      return <span className="badge badge-yellow">Mining</span>;
                    }
                    if (lootIds.has(item.id)) {
                      return <span className="badge badge-orange">Loot</span>;
                    }
                    const recipe = recipesByItem.get(item.id);
                    if (!recipe || (recipe.factories.length === 0 && recipe.refineries.length === 0)) {
                      return <span className="text-gray-600">—</span>;
                    }
                    return (
                      <>
                        {recipe.factories.map((f) => <span key={f} className={`badge ${f === "Build" ? "badge-build" : "badge-blue"}`}>{f}</span>)}
                        {recipe.refineries.map((r) => <span key={r} className="badge badge-purple">{r}</span>)}
                      </>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
