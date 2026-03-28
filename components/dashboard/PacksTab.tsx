"use client";

import { useEffect, useState, useCallback } from "react";
import PackCalculation from "@/components/packs/PackCalculation";
import SsuAddressBar from "@/components/common/SsuAddressBar";
import { useSsuAddress } from "@/hooks/useSsuAddress";

interface Item { id: string; name: string; isRawMaterial: boolean; isFound: boolean; blueprints: { factory: string }[] }
interface PackItem { id: string; itemId: string; quantity: number; item: Item }
interface Pack { id: string; name: string; description?: string; items: PackItem[] }

const emptyRow = () => ({ itemId: "", quantity: 1 });

export default function PacksTab() {
  const { address: ssuAddress, saveAddress } = useSsuAddress();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [calcPackId, setCalcPackId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [ignoreSsu, setIgnoreSsu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [packRes, itemRes] = await Promise.all([fetch("/api/packs"), fetch("/api/items")]);
    setPacks(await packRes.json());
    setItems(await itemRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditId(null); setName(""); setDescription(""); setRows([emptyRow()]); setError("");
    setShowForm(true);
  }

  function openEdit(pack: Pack) {
    setEditId(pack.id);
    setName(pack.name);
    setDescription(pack.description ?? "");
    setRows(pack.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })));
    setError(""); setShowForm(true);
  }

  function addRow() { setRows([...rows, emptyRow()]); }
  function removeRow(idx: number) { setRows(rows.filter((_, i) => i !== idx)); }
  function updateRow(idx: number, field: "itemId" | "quantity", value: string | number) {
    setRows(rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  async function save() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (rows.some((r) => !r.itemId)) { setError("All rows need an item"); return; }
    setSaving(true);
    try {
      const url = editId ? `/api/packs/${editId}` : "/api/packs";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, items: rows }),
      });
      if (!res.ok) {
        let msg = "Error";
        try { msg = (await res.json()).error ?? msg; } catch {}
        setError(msg);
        return;
      }
      setShowForm(false);
      load();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, packName: string) {
    if (!confirm(`Delete pack "${packName}"?`)) return;
    await fetch(`/api/packs/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-100">Production Packs</h2>
        <button onClick={openNew} className="btn-primary">+ New Pack</button>
      </div>

      {/* SSU Address Bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <SsuAddressBar
            address={ssuAddress}
            onSave={saveAddress}
            onRefresh={() => calcPackId && setRefreshKey(k => k + 1)}
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

      {/* Search */}
      <div className="relative flex-1 max-w-xs mb-4">
        <input
          placeholder="Search packs…"
          className="input w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">✕</button>}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : packs.length === 0 ? (
        <p className="text-gray-500">No packs yet.</p>
      ) : (
        (() => {
          const filtered = packs.filter((pack) => {
            if (search && !pack.name.toLowerCase().includes(search.toLowerCase())) return false;
            if (calcPackId && pack.id !== calcPackId) return false;
            return true;
          });
          return (
        <div className="space-y-4">
          {filtered.length === 0 && search && (
            <p className="text-gray-500">No packs match &quot;{search}&quot;.</p>
          )}
          {filtered.map((pack) => (
            <div key={pack.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-semibold text-gray-100">{pack.name}</h3>
                  {pack.description && <p className="text-sm text-gray-500 mt-0.5">{pack.description}</p>}
                </div>
                {(() => {
                    const missing = pack.items.filter((pi) => !pi.item.isRawMaterial && !pi.item.isFound && pi.item.blueprints.length === 0);
                    return missing.length > 0 ? (
                      <div className="flex items-center gap-1.5 rounded bg-yellow-900/30 border border-yellow-700/50 px-2 py-1 text-xs text-yellow-400">
                        <span>⚠</span>
                        <span>No blueprint: {missing.map((pi) => pi.item.name).join(", ")}</span>
                      </div>
                    ) : null;
                  })()}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setCalcPackId(calcPackId === pack.id ? null : pack.id)}
                    className={`btn-sm ${calcPackId === pack.id ? "btn-primary" : ""}`}
                  >
                    {calcPackId === pack.id ? "Hide Calc" : "Calculate"}
                  </button>
                  <button onClick={() => openEdit(pack)} className="btn-sm">Edit</button>
                  <button onClick={() => remove(pack.id, pack.name)} className="btn-sm btn-danger">Del</button>
                </div>
              </div>

              {calcPackId === pack.id && <PackCalculation packId={pack.id} refreshKey={refreshKey} ignoreSsu={ignoreSsu} />}
            </div>
          ))}
        </div>
          );
        })()
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editId ? "Edit Pack" : "New Pack"}</h2>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <label className="block mb-3">
              <span className="label">Pack Name</span>
              <input className="input w-full mt-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>

            <label className="block mb-4">
              <span className="label">Description (optional)</span>
              <input className="input w-full mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>

            <div className="mb-2">
              <span className="label">Items to produce</span>
              <div className="space-y-2 mt-2">
                {rows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      className="input flex-1"
                      value={row.itemId}
                      onChange={(e) => updateRow(idx, "itemId", e.target.value)}
                    >
                      <option value="">Select item…</option>
                      {items.map((i) => (
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
                      disabled={rows.length === 1}
                    >✕</button>
                  </div>
                ))}
              </div>
              <button onClick={addRow} className="btn-ghost text-xs mt-2">+ Add item</button>
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
