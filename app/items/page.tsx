"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";

interface ItemData {
  id: string;
  name: string;
  isRawMaterial: boolean;
  isFound: boolean;
  isFinalProduct: boolean;
  volume: number;
  stock: { quantity: number } | null;
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

const emptyForm = { name: "", isRawMaterial: false, isFound: false, isFinalProduct: false, volume: 0 };

export default function ItemsPage() {
  const { canEdit: isAdmin } = useSession();
  const [items, setItems] = useState<ItemData[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [showOre, setShowOre] = useState(false);
  const [oreCount, setOreCount] = useState(0);
  const [showLoot, setShowLoot] = useState(false);
  const [lootCount, setLootCount] = useState(0);
  const [lootIds, setLootIds] = useState<Set<string>>(new Set());
  const [recipesByItem, setRecipesByItem] = useState<Map<string, { factories: string[]; refineries: string[] }>>(new Map());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

    // Loot = items sin blueprint AND no ores (raw materials) AND no outputs de descomposición
    const decompOutputIds = new Set<string>();
    decomps.forEach((d: Decomposition) => {
      if (d.outputs && Array.isArray(d.outputs)) {
        d.outputs.forEach((o) => decompOutputIds.add(o.itemId));
      }
    });
    const trueLoot = allItems.filter((i: ItemData) =>
      !bpOutputIds.has(i.id) && !i.isRawMaterial && !decompOutputIds.has(i.id)
    );
    const trueLootIdSet = new Set<string>(trueLoot.map((i: ItemData) => i.id));

    // Build recipes map: itemId -> { factories, refineries }
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
      // Find all outputs of this decomposition to link them
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

    const ores = allItems.filter((i: ItemData) => i.isRawMaterial && !i.isFound && i.blueprints.length === 0 && !i.isFinalProduct);

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

  function openNew() {
    setForm(emptyForm);
    setEditId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(item: ItemData) {
    setForm({ name: item.name, isRawMaterial: item.isRawMaterial, isFound: item.isFound, isFinalProduct: item.isFinalProduct, volume: item.volume });
    setEditId(item.id);
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    const url = editId ? `/api/items/${editId}` : "/api/items";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) { setError((await res.json()).error ?? "Error"); setSaving(false); return; }
    setSaving(false);
    setShowForm(false);
    load();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Items</h1>
          <p className="text-xs text-gray-500 mt-1">
            {loading ? "Loading…" : search ? `${items.length} of ${totalItems} items` : `${totalItems} items`}
          </p>
        </div>
        {isAdmin && <button onClick={openNew} className="btn-primary">+ New Item</button>}
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
              <th className="pb-2 pr-3">Stock</th>
              <th className="pb-2 pr-3">Recipes</th>
              <th className="pb-2 pl-2"></th>
            </tr>
          </thead>
          <tbody>
            {(showOre ? items.filter(i => i.isRawMaterial && !i.isFound && i.blueprints.length === 0 && !i.isFinalProduct) : showLoot ? items.filter(i => lootIds.has(i.id)) : items).map((item) => (
              <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 h-8 align-middle">
                <td className="py-1 pr-3 font-medium text-gray-100 whitespace-nowrap align-middle">{item.name}</td>
                <td className="py-1 pr-3 text-xs whitespace-nowrap overflow-hidden">
                  {item.isRawMaterial && <span className="badge badge-yellow">Ore</span>}
                  {item.isFound && <span className="badge badge-blue">Raw</span>}
                  {item.blueprints.length > 0 && !item.isFinalProduct && <span className="badge badge-gray">Intermediate</span>}
                  {item.isFinalProduct && <span className="badge badge-cyan">Final</span>}
                  {!item.isRawMaterial && !item.isFound && !item.isFinalProduct && item.blueprints.length === 0 && <span className="text-gray-600">—</span>}
                </td>
                <td className="py-1 pr-3 text-right text-gray-400 whitespace-nowrap">
                  {item.volume > 0 ? <span>{item.volume} m³</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="py-1 pr-3 text-gray-400 whitespace-nowrap">{item.stock?.quantity ?? 0}</td>
                <td className="py-1 pr-3 text-xs whitespace-nowrap overflow-hidden">
                  {(() => {
                    if (item.isRawMaterial) {
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
                {isAdmin && (
                  <td className="py-1 pl-2 flex gap-2 justify-end whitespace-nowrap">
                    <button onClick={() => openEdit(item)} className="btn-sm">Edit</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editId ? "Edit Item" : "New Item"}</h2>

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <label className="block mb-3">
              <span className="label">Name</span>
              <input
                className="input w-full mt-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Item name"
                autoFocus
              />
            </label>

            <label className="flex items-center gap-3 mb-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle"
                checked={form.isRawMaterial}
                onChange={(e) => setForm({ ...form, isRawMaterial: e.target.checked })}
              />
              <span className="label">Ore (mined, decomposed)</span>
            </label>

            <label className="flex items-center gap-3 mb-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle"
                checked={form.isFound}
                onChange={(e) => setForm({ ...form, isFound: e.target.checked })}
              />
              <span className="label">Raw material (found/looted)</span>
            </label>

            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                className="toggle"
                checked={form.isFinalProduct}
                onChange={(e) => setForm({ ...form, isFinalProduct: e.target.checked })}
              />
              <span className="label">Final Product (top of chain)</span>
            </label>

            <label className="block mb-6">
              <span className="label">Volume (m³ per unit)</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="input w-32"
                  value={form.volume}
                  onChange={(e) => setForm({ ...form, volume: Math.max(0, Number(e.target.value)) })}
                />
                <span className="text-gray-500 text-sm">m³</span>
              </div>
            </label>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
