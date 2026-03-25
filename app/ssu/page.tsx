"use client";

import { useState, useMemo } from "react";

interface InventoryItem {
  typeId: number;
  name: string;
  quantity: number;
  volume: number;
  groupName: string;
  categoryName: string;
}

interface SsuData {
  address: string;
  name: string;
  status: string;
  usedCapacity: number;
  maxCapacity: number;
  items: InventoryItem[];
}

type SortKey = "name" | "groupName" | "quantity" | "totalVolume";
type SortDir = "asc" | "desc";

function SortHeader({
  label, sortKey, current, dir, onSort, className,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void; className?: string;
}) {
  const active = current === sortKey;
  return (
    <th
      className={`px-4 py-2 cursor-pointer select-none hover:text-gray-200 transition-colors ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-gray-600">
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  );
}

export default function SsuPage() {
  const [address, setAddress] = useState("");
  const [data, setData] = useState<SsuData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function fetchInventory() {
    const addr = address.trim();
    if (!addr) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/ssu-inventory?address=${encodeURIComponent(addr)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error fetching inventory");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "quantity" || key === "totalVolume" ? "desc" : "asc");
    }
  }

  const sortedItems = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "groupName") cmp = a.groupName.localeCompare(b.groupName);
      else if (sortKey === "quantity") cmp = a.quantity - b.quantity;
      else if (sortKey === "totalVolume") cmp = (a.quantity * a.volume) - (b.quantity * b.volume);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const capacityPct = data && data.maxCapacity > 0
    ? Math.round((data.usedCapacity / data.maxCapacity) * 100)
    : 0;

  const totalVolume = data
    ? data.items.reduce((sum, i) => sum + i.quantity * i.volume, 0)
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Smart Storage Unit</h1>
        <p className="text-sm text-gray-500 mt-1">Inventario on-chain de un SSU</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchInventory()}
          placeholder="0x..."
          className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-600"
        />
        <button
          onClick={fetchInventory}
          disabled={loading || !address.trim()}
          className="rounded bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {loading ? "Cargando..." : "Consultar"}
        </button>
      </div>

      {error && (
        <div className="rounded bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 font-mono">{data.address}</span>
                {data.name && (
                  <p className="text-base font-semibold text-gray-100 mt-0.5">{data.name}</p>
                )}
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  data.status === "ONLINE"
                    ? "bg-green-900/50 text-green-400"
                    : "bg-red-900/50 text-red-400"
                }`}
              >
                {data.status}
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Capacidad</span>
                <span>
                  {data.usedCapacity.toLocaleString()} / {data.maxCapacity.toLocaleString()} m³
                  {" "}({capacityPct}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-800">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    capacityPct > 80 ? "bg-red-500" : capacityPct > 50 ? "bg-yellow-500" : "bg-cyan-500"
                  }`}
                  style={{ width: `${Math.min(capacityPct, 100)}%` }}
                />
              </div>
            </div>

            <div className="text-xs text-gray-500">
              {data.items.length} tipos de item · {totalVolume.toLocaleString()} m³ total
            </div>
          </div>

          {data.items.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">El SSU está vacío</p>
          ) : (
            <div className="rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-xs text-gray-400 uppercase tracking-wider">
                    <SortHeader label="Item" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} className="text-left" />
                    <SortHeader label="Grupo" sortKey="groupName" current={sortKey} dir={sortDir} onSort={handleSort} className="text-left hidden sm:table-cell" />
                    <SortHeader label="Cantidad" sortKey="quantity" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
                    <SortHeader label="Vol. total" sortKey="totalVolume" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right hidden sm:table-cell" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sortedItems.map((item) => (
                    <tr key={item.typeId} className="hover:bg-gray-900/50 transition-colors">
                      <td className="px-4 py-2">
                        <span className="text-gray-100 font-medium">{item.name}</span>
                        <span className="ml-2 text-xs text-gray-600">#{item.typeId}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs hidden sm:table-cell">
                        {item.groupName}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-100 font-medium">
                        {item.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400 hidden sm:table-cell">
                        {(item.quantity * item.volume).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
