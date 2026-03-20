"use client";

import { useEffect, useState } from "react";

interface Factory {
  id: string;
  name: string;
}

export default function FactoriesPage() {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/factories");
    setFactories(await res.json());
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditId(null);
    setName("");
    setError("");
    setShowForm(true);
  }

  function openEdit(f: Factory) {
    setEditId(f.id);
    setName(f.name);
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    const url = editId ? `/api/factories/${editId}` : "/api/factories";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Error saving");
    } else {
      setShowForm(false);
      await load();
    }
    setSaving(false);
  }

  async function deleteFactory(id: string, factoryName: string) {
    if (!confirm(`Delete factory "${factoryName}"?`)) return;
    await fetch(`/api/factories/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Factories</h1>
        <button className="btn-sm btn-primary" onClick={openNew}>+ New Factory</button>
      </div>

      {factories.length === 0 ? (
        <p className="text-gray-500 text-sm">No factories yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800 text-left">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {factories.map((f) => (
              <tr key={f.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 pr-4 font-medium text-gray-200">{f.name}</td>
                <td className="py-2 text-right space-x-2">
                  <button className="btn-ghost text-xs" onClick={() => openEdit(f)}>Edit</button>
                  <button className="btn-ghost btn-danger text-xs" onClick={() => deleteFactory(f.id, f.name)}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-100 mb-4">
              {editId ? "Edit Factory" : "New Factory"}
            </h2>
            <label className="label">Name</label>
            <input
              className="input w-full mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Field Printer"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-sm btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-sm btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
