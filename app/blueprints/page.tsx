"use client";

import { useEffect, useState, useCallback } from "react";

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

// Group blueprints by outputItem
type GroupedBlueprints = { item: Item; blueprints: Blueprint[] }[];

const emptyInputRow = () => ({ itemId: "", quantity: 1 });

export default function BlueprintsPage() {
  const [grouped, setGrouped] = useState<GroupedBlueprints>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [factories, setFactories] = useState<{id: string; name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [outputItemId, setOutputItemId] = useState("");
  const [factory, setFactory] = useState("");
  const [outputQty, setOutputQty] = useState(1);
  const [isDefault, setIsDefault] = useState(true);
  const [inputs, setInputs] = useState([emptyInputRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [bpRes, itemRes, factoriesRes] = await Promise.all([fetch("/api/blueprints"), fetch("/api/items"), fetch("/api/factories")]);
    const blueprints: Blueprint[] = await bpRes.json();
    const items: Item[] = await itemRes.json();
    const factoriesList: {id: string; name: string}[] = await factoriesRes.json();
    setAllItems(items);
    setFactories(factoriesList);

    // Group blueprints by outputItem
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

  function openNew() {
    setEditId(null); setOutputItemId(""); setFactory(""); setOutputQty(1); setIsDefault(true);
    setInputs([emptyInputRow()]); setError(""); setShowForm(true);
  }

  function openEdit(bp: Blueprint) {
    setEditId(bp.id); setOutputItemId(bp.outputItem.id); setFactory(bp.factory);
    setOutputQty(bp.outputQty); setIsDefault(bp.isDefault);
    setInputs(bp.inputs.map((i) => ({ itemId: i.itemId, quantity: i.quantity })));
    setError(""); setShowForm(true);
  }

  function addInputRow() { setInputs([...inputs, emptyInputRow()]); }
  function removeInputRow(idx: number) { setInputs(inputs.filter((_, i) => i !== idx)); }
  function updateInput(idx: number, field: "itemId" | "quantity", value: string | number) {
    setInputs(inputs.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  }

  async function save() {
    if (!outputItemId) { setError("Select an output item"); return; }
    if (inputs.some((r) => !r.itemId)) { setError("All input rows need an item selected"); return; }
    if (inputs.some((r) => r.quantity < 1)) { setError("Quantities must be ≥ 1"); return; }

    setSaving(true);
    const url = editId ? `/api/blueprints/${editId}` : "/api/blueprints";
    const method = editId ? "PUT" : "POST";
    const body = editId
      ? { factory, outputQty, isDefault, inputs }
      : { outputItemId, factory, outputQty, isDefault, inputs };

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setError((await res.json()).error ?? "Error"); setSaving(false); return; }
    setSaving(false); setShowForm(false); load();
  }

  async function remove(id: string, itemName: string, factoryName: string) {
    const label = factoryName ? `${itemName} (${factoryName})` : itemName;
    if (!confirm(`Delete blueprint for "${label}"?`)) return;
    await fetch(`/api/blueprints/${id}`, { method: "DELETE" });
    load();
  }

  async function setDefault(id: string) {
    await fetch(`/api/blueprints/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    load();
  }

  function toggleExpand(itemId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) { next.delete(itemId); } else { next.add(itemId); }
      return next;
    });
  }

  const inputItems = allItems.filter((i) => i.id !== outputItemId);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Blueprints</h1>
        <button onClick={openNew} className="btn-primary">+ New Blueprint</button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : grouped.length === 0 ? (
        <p className="text-gray-500">No blueprints yet. Create items first, then add blueprints.</p>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ item, blueprints }) => (
            <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-900">
              {/* Item header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="text-gray-500 hover:text-gray-300 text-xs w-4"
                >
                  {expanded.has(item.id) ? "▼" : "▶"}
                </button>
                <span className="flex-1 font-semibold text-gray-100">{item.name}</span>
                <span className="text-xs text-gray-600">{blueprints.length} blueprint{blueprints.length > 1 ? "s" : ""}</span>
              </div>

              {/* Blueprint rows */}
              {expanded.has(item.id) && (
                <div className="divide-y divide-gray-800/50">
                  {blueprints.map((bp) => (
                    <div key={bp.id} className="px-4 py-3">
                      <div className="flex items-center gap-3 mb-2">
                        {/* Default star */}
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
                        <button onClick={() => openEdit(bp)} className="btn-sm">Edit</button>
                        <button onClick={() => remove(bp.id, item.name, bp.factory)} className="btn-sm btn-danger">Del</button>
                      </div>

                      {/* Inputs table */}
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

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editId ? "Edit Blueprint" : "New Blueprint"}</h2>

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            {!editId && (
              <label className="block mb-3">
                <span className="label">Output Item</span>
                <select
                  className="input w-full mt-1"
                  value={outputItemId}
                  onChange={(e) => setOutputItemId(e.target.value)}
                >
                  <option value="">Select item…</option>
                  {allItems.filter((i) => !i.isRawMaterial).map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </label>
            )}

            {editId && (
              <p className="text-sm text-gray-400 mb-3">
                Output: <strong className="text-gray-200">
                  {grouped.flatMap((g) => g.blueprints).find((b) => b.id === editId)?.outputItem.name}
                </strong>
              </p>
            )}

            <label className="block mb-3">
              <span className="label">Factory</span>
              <select
                className="input w-full mt-1"
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
              >
                <option value="">No factory</option>
                {factories.map((f) => (
                  <option key={f.id} value={f.name}>{f.name}</option>
                ))}
              </select>
            </label>

            <label className="block mb-4">
              <span className="label">Units produced per run</span>
              <input
                type="number" min={1}
                className="input w-24 mt-1"
                value={outputQty}
                onChange={(e) => setOutputQty(Number(e.target.value))}
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
              <span className="label">Input Materials</span>
              <div className="space-y-2 mt-2">
                {inputs.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      className="input flex-1"
                      value={row.itemId}
                      onChange={(e) => updateInput(idx, "itemId", e.target.value)}
                    >
                      <option value="">Select item…</option>
                      {inputItems.map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                    <input
                      type="number" min={1}
                      className="input w-20"
                      value={row.quantity}
                      onChange={(e) => updateInput(idx, "quantity", Number(e.target.value))}
                    />
                    <button
                      onClick={() => removeInputRow(idx)}
                      className="text-gray-600 hover:text-red-400 px-1"
                      disabled={inputs.length === 1}
                    >✕</button>
                  </div>
                ))}
              </div>
              <button onClick={addInputRow} className="btn-ghost text-xs mt-2">+ Add material</button>
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
