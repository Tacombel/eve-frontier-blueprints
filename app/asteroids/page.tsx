"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";

interface Location {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  isRawMaterial: boolean;
  isFound?: boolean;
}

interface AsteroidType {
  id: string;
  name: string;
  locations: { location: Location }[];
  items: { item: Item }[];
}

const emptyForm = { name: "", locationIds: [] as string[], itemIds: [] as string[] };

export default function AsteroidsPage() {
  const [asteroids, setAsteroids] = useState<AsteroidType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rawItems, setRawItems] = useState<Item[]>([]);

  const [showAsteroidForm, setShowAsteroidForm] = useState(false);
  const [editAsteroidId, setEditAsteroidId] = useState<string | null>(null);
  const { canEdit: isAdmin } = useSession();
  const [asteroidForm, setAsteroidForm] = useState(emptyForm);

  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadAll() {
    const [a, l, i] = await Promise.all([
      fetch("/api/asteroids").then((r) => r.json()),
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/items?isRawMaterial=true").then((r) => r.json()),
    ]);
    setAsteroids(a);
    setLocations(l);
    setRawItems(i);
  }

  useEffect(() => { loadAll(); }, []);

  // --- Asteroid CRUD ---
  function openNewAsteroid() {
    setEditAsteroidId(null);
    setAsteroidForm(emptyForm);
    setError("");
    setShowAsteroidForm(true);
  }

  function openEditAsteroid(a: AsteroidType) {
    setEditAsteroidId(a.id);
    setAsteroidForm({
      name: a.name,
      locationIds: a.locations.map((l) => l.location.id),
      itemIds: a.items.map((i) => i.item.id),
    });
    setError("");
    setShowAsteroidForm(true);
  }

  async function saveAsteroid() {
    if (!asteroidForm.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    const url = editAsteroidId ? `/api/asteroids/${editAsteroidId}` : "/api/asteroids";
    const method = editAsteroidId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(asteroidForm),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Error saving");
    } else {
      setShowAsteroidForm(false);
      await loadAll();
    }
    setSaving(false);
  }

  function toggleId(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  }

  // --- Location CRUD ---
  function openNewLocation() {
    setEditLocationId(null);
    setLocationName("");
    setError("");
    setShowLocationForm(true);
  }

  function openEditLocation(l: Location) {
    setEditLocationId(l.id);
    setLocationName(l.name);
    setError("");
    setShowLocationForm(true);
  }

  async function saveLocation() {
    if (!locationName.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    const url = editLocationId ? `/api/locations/${editLocationId}` : "/api/locations";
    const method = editLocationId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: locationName }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Error saving");
    } else {
      setShowLocationForm(false);
      await loadAll();
    }
    setSaving(false);
  }

  return (
    <div className="p-6 space-y-10 max-w-4xl">
      <h1 className="text-xl font-bold text-gray-100">Asteroids &amp; Locations</h1>

      {/* ── Asteroid Types ─────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-cyan-300">Asteroid Types</h2>
          {isAdmin && <button className="btn-sm btn-primary" onClick={openNewAsteroid}>+ Add</button>}
        </div>

        {asteroids.length === 0 ? (
          <p className="text-gray-500 text-sm">No asteroid types yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-left">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Locations</th>
                <th className="pb-2 pr-4 w-96">Ore Items</th>
                <th className="pb-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {asteroids.map((a) => (
                <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 pr-4 font-medium text-gray-200">{a.name}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {a.locations.length === 0
                        ? <span className="text-gray-600 text-xs">—</span>
                        : a.locations.map((l) => (
                          <span key={l.location.id} className="badge badge-blue">{l.location.name}</span>
                        ))}
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {a.items.length === 0
                        ? <span className="text-gray-600 text-xs">—</span>
                        : a.items.map((i) => (
                          <span key={i.item.id} className="badge badge-yellow">{i.item.name}</span>
                        ))}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="py-2 text-right">
                      <button className="btn-ghost text-xs" onClick={() => openEditAsteroid(a)}>Edit</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Locations ──────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-cyan-300">Locations</h2>
          {isAdmin && <button className="btn-sm btn-primary" onClick={openNewLocation}>+ Add</button>}
        </div>

        {locations.length === 0 ? (
          <p className="text-gray-500 text-sm">No locations yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-left">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Used in</th>
                <th className="pb-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => {
                const usedIn = asteroids.filter((a) =>
                  a.locations.some((al) => al.location.id === l.id)
                );
                return (
                  <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-4 font-medium text-gray-200">{l.name}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {usedIn.length === 0
                          ? <span className="text-gray-600 text-xs">—</span>
                          : usedIn.map((a) => (
                            <span key={a.id} className="badge badge-blue">{a.name}</span>
                          ))}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="py-2 text-right">
                        <button className="btn-ghost text-xs" onClick={() => openEditLocation(l)}>Edit</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Modal: Asteroid Type ───────────────────────── */}
      {showAsteroidForm && (
        <div className="modal-backdrop" onClick={() => setShowAsteroidForm(false)}>
          <div className="modal w-[520px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-100 mb-4">
              {editAsteroidId ? "Edit Asteroid Type" : "New Asteroid Type"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input
                  className="input w-full mt-1"
                  value={asteroidForm.name}
                  onChange={(e) => setAsteroidForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Veldspar"
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Locations</label>
                {locations.length === 0 ? (
                  <p className="text-gray-500 text-xs mt-1">No locations yet. Add them first.</p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {locations.map((l) => {
                      const selected = asteroidForm.locationIds.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setAsteroidForm((f) => ({ ...f, locationIds: toggleId(f.locationIds, l.id) }))}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            selected
                              ? "bg-cyan-700/40 border-cyan-600 text-cyan-200"
                              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                          }`}
                        >
                          {l.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="label">Ore Items</label>
                {rawItems.length === 0 ? (
                  <p className="text-gray-500 text-xs mt-1">No raw materials defined.</p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {rawItems.map((item) => {
                      const selected = asteroidForm.itemIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAsteroidForm((f) => ({ ...f, itemIds: toggleId(f.itemIds, item.id) }))}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            selected
                              ? "bg-yellow-700/40 border-yellow-600 text-yellow-200"
                              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                          }`}
                        >
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-sm btn-ghost" onClick={() => setShowAsteroidForm(false)}>Cancel</button>
              <button className="btn-sm btn-primary" onClick={saveAsteroid} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Location ────────────────────────────── */}
      {showLocationForm && (
        <div className="modal-backdrop" onClick={() => setShowLocationForm(false)}>
          <div className="modal w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-100 mb-4">
              {editLocationId ? "Edit Location" : "New Location"}
            </h2>
            <label className="label">Name</label>
            <input
              className="input w-full mt-1"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Belt X-1"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveLocation()}
            />
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-sm btn-ghost" onClick={() => setShowLocationForm(false)}>Cancel</button>
              <button className="btn-sm btn-primary" onClick={saveLocation} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
