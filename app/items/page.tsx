"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";

interface Item {
  id: string;
  name: string;
  isRawMaterial: boolean;
  isFound: boolean;
  isFinalProduct: boolean;
  volume: number;
  stock: { quantity: number } | null;
  blueprints: { id: string; factory: string; outputQty: number; isDefault: boolean }[];
}

const emptyForm = { name: "", isRawMaterial: false, isFound: false, isFinalProduct: false, volume: 0 };

export default function ItemsPage() {
  const { isAdmin } = useSession();
  const [items, setItems] = useState<Item[]>([]);
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

    const bpOutputIds = new Set(bps.map((b: any) => b.outputItem?.id).filter(Boolean));
    const decompSourceIdSet = new Set(decomps.map((d: any) => d.sourceItem?.id).filter(Boolean));
    const loot = allItems.filter((i: any) => !bpOutputIds.has(i.id) && !decompSourceIdSet.has(i.id));
    const lootIdSet = new Set(loot.map((i: any) => i.id));

    // Loot = items sin blueprint AND no ores (raw materials) AND no outputs de descomposición
    const decompOutputIds = new Set();
    decomps.forEach((d: any) => {
      if (d.outputs && Array.isArray(d.outputs)) {
        d.outputs.forEach((o: any) => decompOutputIds.add(o.itemId));
      }
    });
    const trueLoot = allItems.filter((i: any) =>
      !bpOutputIds.has(i.id) && !i.isRawMaterial && !decompOutputIds.has(i.id)
    );
    const trueLootIdSet = new Set(trueLoot.map((i: any) => i.id));

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

    const ores = allItems.filter((i: any) => i.isRawMaterial);

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

  function openEdit(item: Item) {
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

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/items/${id}`, { method: "DELETE" });
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
        <input
          className="input flex-1 max-w-xs"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4 text-right">Volume</th>
              <th className="pb-2 pr-4">Stock</th>
              <th className="pb-2 pr-4">Recipes</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {(showOre ? items.filter(i => i.isRawMaterial && !i.isFound && i.blueprints.length === 0 && !i.isFinalProduct) : showLoot ? items.filter(i => lootIds.has(i.id)) : items).map((item) => (
              <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 pr-4 font-medium text-gray-100">{item.name}</td>
                <td className="py-2 pr-4 flex gap-1 flex-wrap">
                  {item.isRawMaterial && <span className="badge badge-yellow">Ore</span>}
                  {item.isFound && <span className="badge badge-blue">Raw</span>}
                  {item.blueprints.length > 0 && !item.isFinalProduct && <span className="badge badge-gray">Intermediate</span>}
                  {item.isFinalProduct && <span className="badge badge-cyan">Final</span>}
                  {!item.isRawMaterial && !item.isFound && !item.isFinalProduct && item.blueprints.length === 0 && <span className="text-gray-600">—</span>}
                </td>
                <td className="py-2 pr-4 text-right text-gray-400">
                  {item.volume > 0 ? <span>{item.volume} m³</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="py-2 pr-4 text-gray-400">{item.stock?.quantity ?? 0}</td>
                <td className="py-2 pr-4 flex gap-1 flex-wrap items-center">
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
                        {recipe.factories.map((f) => <span key={f} className="badge badge-blue">{f}</span>)}
                        {recipe.refineries.map((r) => <span key={r} className="badge badge-purple">{r}</span>)}
                      </>
                    );
                  })()}
                </td>
                {isAdmin && (
                  <td className="py-2 flex gap-2 justify-end">
                    <button onClick={() => openEdit(item)} className="btn-sm">Edit</button>
                    <button onClick={() => remove(item.id, item.name)} className="btn-sm btn-danger">Del</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
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
