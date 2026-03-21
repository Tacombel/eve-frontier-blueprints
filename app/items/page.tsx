"use client";

import { useEffect, useState } from "react";

interface Item {
  id: string;
  name: string;
  isRawMaterial: boolean;
  isFound: boolean;
  isFinalProduct: boolean;
  stock: { quantity: number } | null;
  blueprints: { id: string; factory: string; outputQty: number; isDefault: boolean }[];
}

const emptyForm = { name: "", isRawMaterial: false, isFound: false, isFinalProduct: false };

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/items?search=${encodeURIComponent(search)}`);
    setItems(await res.json());
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
    setForm({ name: item.name, isRawMaterial: item.isRawMaterial, isFound: item.isFound, isFinalProduct: item.isFinalProduct });
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
        <h1 className="text-2xl font-bold text-gray-100">Items</h1>
        <button onClick={openNew} className="btn-primary">+ New Item</button>
      </div>

      <input
        className="input mb-4 w-full max-w-xs"
        placeholder="Search items…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

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
              <th className="pb-2 pr-4">Stock</th>
              <th className="pb-2 pr-4">Blueprints</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 pr-4 font-medium text-gray-100">{item.name}</td>
                <td className="py-2 pr-4 flex gap-1 flex-wrap">
                  {item.isRawMaterial && <span className="badge badge-yellow">Ore</span>}
                  {item.isFound && <span className="badge badge-blue">Raw</span>}
                  {item.isFinalProduct && <span className="badge badge-cyan">Final</span>}
                  {!item.isRawMaterial && !item.isFound && !item.isFinalProduct && <span className="text-gray-600">—</span>}
                </td>
                <td className="py-2 pr-4 text-gray-400">{item.stock?.quantity ?? 0}</td>
                <td className="py-2 pr-4 text-gray-400">
                  {item.blueprints.length === 0
                    ? <span className="text-gray-600">—</span>
                    : <span>{item.blueprints.length} blueprint{item.blueprints.length > 1 ? "s" : ""}</span>}
                </td>
                <td className="py-2 flex gap-2 justify-end">
                  <button onClick={() => openEdit(item)} className="btn-sm">Edit</button>
                  <button onClick={() => remove(item.id, item.name)} className="btn-sm btn-danger">Del</button>
                </td>
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

            <label className="flex items-center gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                className="toggle"
                checked={form.isFinalProduct}
                onChange={(e) => setForm({ ...form, isFinalProduct: e.target.checked })}
              />
              <span className="label">Final Product (top of chain)</span>
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
