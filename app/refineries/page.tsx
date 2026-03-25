"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "@/hooks/useSession";

interface Refinery {
  id: string;
  name: string;
}

export default function RefineriesPage() {
  const { canEdit: isAdmin } = useSession();
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [decompositions, setDecompositions] = useState<{ refinery: string }[]>([]);
  const decompositionsByRefinery = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of decompositions) counts[d.refinery] = (counts[d.refinery] ?? 0) + 1;
    return counts;
  }, [decompositions]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [rRes, dRes] = await Promise.all([fetch("/api/refineries"), fetch("/api/decompositions")]);
    setRefineries(await rRes.json());
    setDecompositions(await dRes.json());
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditId(null); setName(""); setError(""); setShowForm(true);
  }

  function openEdit(r: Refinery) {
    setEditId(r.id); setName(r.name); setError(""); setShowForm(true);
  }

  async function save() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    const url = editId ? `/api/refineries/${editId}` : "/api/refineries";
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

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Refineries</h1>
        {isAdmin && <button className="btn-sm btn-primary" onClick={openNew}>+ New Refinery</button>}
      </div>

      {refineries.length === 0 ? (
        <p className="text-gray-500 text-sm">No refineries yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800 text-left">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4 text-right">Decompositions</th>
              <th className="pb-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {refineries.map((r) => (
              <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 pr-4 font-medium text-gray-200">{r.name}</td>
                <td className="py-2 pr-4 text-right text-gray-500 text-xs">{decompositionsByRefinery[r.name] ?? 0}</td>
                {isAdmin && (
                  <td className="py-2 text-right">
                    <button className="btn-ghost text-xs" onClick={() => openEdit(r)}>Edit</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-100 mb-4">
              {editId ? "Edit Refinery" : "New Refinery"}
            </h2>
            <label className="label">Name</label>
            <input
              className="input w-full mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Basic Refinery"
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
