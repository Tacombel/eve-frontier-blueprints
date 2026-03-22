"use client";

import { useEffect, useState, useCallback } from "react";

interface Item { id: string; name: string }
interface DecompositionOutput { id: string; itemId: string; quantity: number; item: Item }
interface Decomposition {
  id: string;
  refinery: string;
  inputQty: number;
  isDefault: boolean;
  sourceItem: Item;
  outputs: DecompositionOutput[];
}

const emptyOutputRow = () => ({ itemId: "", quantity: 1 });

export default function DecompositionsPage() {
  const [decompositions, setDecompositions] = useState<Decomposition[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [sourceItemId, setSourceItemId] = useState("");
  const [refinery, setRefinery] = useState("");
  const [inputQty, setInputQty] = useState(1);
  const [isDefault, setIsDefault] = useState(true);
  const [outputs, setOutputs] = useState([emptyOutputRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [decRes, itemRes] = await Promise.all([
      fetch("/api/decompositions"),
      fetch("/api/items"),
    ]);
    setDecompositions(await decRes.json());
    setItems(await itemRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditId(null); setSourceItemId(""); setRefinery(""); setInputQty(1);
    setIsDefault(true); setOutputs([emptyOutputRow()]); setError(""); setShowForm(true);
  }

  function openEdit(d: Decomposition) {
    setEditId(d.id); setSourceItemId(d.sourceItem.id); setRefinery(d.refinery);
    setInputQty(d.inputQty); setIsDefault(d.isDefault);
    setOutputs(d.outputs.map((o) => ({ itemId: o.itemId, quantity: o.quantity })));
    setError(""); setShowForm(true);
  }

  async function setDefault(id: string) {
    await fetch(`/api/decompositions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    load();
  }

  function addRow() { setOutputs([...outputs, emptyOutputRow()]); }
  function removeRow(idx: number) { setOutputs(outputs.filter((_, i) => i !== idx)); }
  function updateRow(idx: number, field: "itemId" | "quantity", value: string | number) {
    setOutputs(outputs.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  async function save() {
    if (!editId && !sourceItemId) { setError("Select a source item"); return; }
    if (outputs.some((r) => !r.itemId)) { setError("All output rows need an item"); return; }
    if (outputs.some((r) => r.quantity < 1)) { setError("Quantities must be ≥ 1"); return; }
    if (inputQty < 1) { setError("Input quantity must be ≥ 1"); return; }

    setSaving(true);
    const url = editId ? `/api/decompositions/${editId}` : "/api/decompositions";
    const method = editId ? "PUT" : "POST";
    const body = editId
      ? { refinery, inputQty, isDefault, outputs }
      : { sourceItemId, refinery, inputQty, isDefault, outputs };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setError((await res.json()).error ?? "Error"); setSaving(false); return; }
    setSaving(false); setShowForm(false); load();
  }

  async function remove(id: string, name: string, ref: string) {
    const label = ref ? `${name} (${ref})` : name;
    if (!confirm(`Delete decomposition for "${label}"?`)) return;
    await fetch(`/api/decompositions/${id}`, { method: "DELETE" });
    load();
  }

  // Group decompositions by source item
  const grouped = decompositions.reduce((acc, d) => {
    const key = d.sourceItem.id;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(d);
    return acc;
  }, new Map<string, Decomposition[]>());

  const outputItems = items.filter((i) => i.id !== sourceItemId);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-100">Decompositions</h1>
        <button onClick={openNew} className="btn-primary">+ New Decomposition</button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Define how a material breaks down when reprocessed. Multiple refineries can yield different outputs.
      </p>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : grouped.size === 0 ? (
        <p className="text-gray-500">No decompositions yet.</p>
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([, entries]) => (
            <div key={entries[0].sourceItem.id} className="rounded-lg border border-gray-800 bg-gray-900">
              <div className="px-4 py-3 border-b border-gray-800">
                <span className="font-semibold text-gray-100">{entries[0].sourceItem.name}</span>
                <span className="ml-2 text-xs text-gray-600">{entries.length} decomposition{entries.length > 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y divide-gray-800/50">
                {entries.map((d) => (
                  <div key={d.id} className="px-4 py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        onClick={() => !d.isDefault && setDefault(d.id)}
                        title={d.isDefault ? "Default decomposition" : "Set as default"}
                        className={`text-base leading-none ${d.isDefault ? "text-yellow-400" : "text-gray-700 hover:text-yellow-600"}`}
                      >
                        ★
                      </button>
                      <span className="flex-1 text-sm text-gray-300">
                        {d.refinery ? <span className="badge badge-blue">{d.refinery}</span> : <span className="text-gray-600 italic text-xs">No refinery</span>}
                      </span>
                      {d.isDefault && <span className="badge badge-yellow text-xs">Default</span>}
                      <span className="text-xs text-gray-500">{d.inputQty} u/run</span>
                      <button onClick={() => openEdit(d)} className="btn-sm">Edit</button>
                      <button onClick={() => remove(d.id, d.sourceItem.name, d.refinery)} className="btn-sm btn-danger">Del</button>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-6">
                      {d.outputs.map((o) => (
                        <span key={o.id} className="text-xs bg-gray-800 rounded px-2 py-1 text-gray-300">
                          {o.item.name} <span className="text-yellow-400">×{o.quantity}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">
              {editId ? "Edit Decomposition" : "New Decomposition"}
            </h2>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            {!editId && (
              <label className="block mb-3">
                <span className="label">Source Item (material to decompose)</span>
                <select
                  className="input w-full mt-1"
                  value={sourceItemId}
                  onChange={(e) => setSourceItemId(e.target.value)}
                  autoFocus
                >
                  <option value="">Select item…</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </label>
            )}

            {editId && (
              <p className="text-sm text-gray-400 mb-3">
                Source: <strong className="text-gray-200">
                  {decompositions.find((d) => d.id === editId)?.sourceItem.name}
                </strong>
              </p>
            )}

            <label className="block mb-3">
              <span className="label">Refinery</span>
              <input
                type="text"
                placeholder="Leave empty for generic"
                className="input w-full mt-1"
                value={refinery}
                onChange={(e) => setRefinery(e.target.value)}
              />
            </label>

            <label className="block mb-4">
              <span className="label">Units of source per decomposition run</span>
              <input
                type="number" min={1}
                className="input w-24 mt-1"
                value={inputQty}
                onChange={(e) => setInputQty(Number(e.target.value))}
              />
            </label>

            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                className="toggle"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <span className="label">Use as default for calculations</span>
            </label>

            <div className="mb-2">
              <span className="label">Output Materials (what you get)</span>
              <div className="space-y-2 mt-2">
                {outputs.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      className="input flex-1"
                      value={row.itemId}
                      onChange={(e) => updateRow(idx, "itemId", e.target.value)}
                    >
                      <option value="">Select material…</option>
                      {outputItems.map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                    <input
                      type="number" min={1}
                      className="input w-20"
                      value={row.quantity}
                      onChange={(e) => updateRow(idx, "quantity", Number(e.target.value))}
                    />
                    <button
                      onClick={() => removeRow(idx)}
                      className="text-gray-600 hover:text-red-400 px-1"
                      disabled={outputs.length === 1}
                    >✕</button>
                  </div>
                ))}
              </div>
              <button onClick={addRow} className="btn-ghost text-xs mt-2">+ Add output</button>
            </div>

            <div className="flex gap-3 justify-end mt-4">
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
