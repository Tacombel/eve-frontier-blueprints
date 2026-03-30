"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSsuList } from "@/hooks/useSsuList";
import { useSsuIgnored } from "@/hooks/useSsuIgnored";

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

function SortHeader({ label, sortKey, current, dir, onSort, className }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void; className?: string;
}) {
  const active = current === sortKey;
  return (
    <th className={`px-4 py-2 cursor-pointer select-none hover:text-gray-200 transition-colors ${className ?? ""}`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-gray-600">{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </span>
    </th>
  );
}

function Toggle({ on, onChange, title }: { on: boolean; onChange: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onChange}
      title={title}
      className={`relative inline-flex h-4 w-8 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${on ? "bg-cyan-600" : "bg-gray-600"}`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ${on ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

function ItemTable({ items, sortKey, sortDir, onSort }: {
  items: InventoryItem[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No items</p>;
  }
  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-900 text-xs text-gray-400 uppercase tracking-wider">
            <SortHeader label="Item" sortKey="name" current={sortKey} dir={sortDir} onSort={onSort} className="text-left" />
            <SortHeader label="Group" sortKey="groupName" current={sortKey} dir={sortDir} onSort={onSort} className="text-left hidden sm:table-cell" />
            <SortHeader label="Quantity" sortKey="quantity" current={sortKey} dir={sortDir} onSort={onSort} className="text-right" />
            <SortHeader label="Total vol." sortKey="totalVolume" current={sortKey} dir={sortDir} onSort={onSort} className="text-right hidden sm:table-cell" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {items.map((item) => (
            <tr key={item.typeId} className="hover:bg-gray-900/50 transition-colors">
              <td className="px-4 py-2">
                <span className="text-gray-100 font-medium">{item.name}</span>
                <span className="ml-2 text-xs text-gray-600">#{item.typeId}</span>
              </td>
              <td className="px-4 py-2 text-gray-400 text-xs hidden sm:table-cell">{item.groupName}</td>
              <td className="px-4 py-2 text-right text-gray-100 font-medium">{item.quantity.toLocaleString()}</td>
              <td className="px-4 py-2 text-right text-gray-400 hidden sm:table-cell">{(item.quantity * item.volume).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SsuTab() {
  const { ssus, loading: listLoading, error: listError } = useSsuList();
  const { ignoredSet, toggleIgnored } = useSsuIgnored();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<SsuData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Combined stock state
  const [combinedItems, setCombinedItems] = useState<InventoryItem[]>([]);
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const fetchKeyRef = useRef(0);

  // Active SSU addresses (not ignored, regardless of online status)
  const activeSsuAddresses = useMemo(
    () => ssus.filter((s) => !ignoredSet.has(s.address)).map((s) => s.address),
    [ssus, ignoredSet]
  );
  const activeSsuKey = activeSsuAddresses.join(",");

  // Fetch and merge inventories for all active SSUs
  useEffect(() => {
    if (activeSsuAddresses.length === 0) {
      setCombinedItems([]);
      return;
    }
    const key = ++fetchKeyRef.current;
    setCombinedLoading(true);
    Promise.all(
      activeSsuAddresses.map((addr) =>
        fetch(`/api/ssu-inventory?address=${encodeURIComponent(addr)}`)
          .then((r) => r.json())
          .then((json: SsuData) => json.items ?? [])
          .catch(() => [] as InventoryItem[])
      )
    ).then((allItems) => {
      if (fetchKeyRef.current !== key) return; // stale
      const merged = new Map<number, InventoryItem>();
      for (const items of allItems) {
        for (const item of items) {
          const existing = merged.get(item.typeId);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            merged.set(item.typeId, { ...item });
          }
        }
      }
      setCombinedItems([...merged.values()]);
    }).finally(() => {
      if (fetchKeyRef.current === key) setCombinedLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSsuKey, refreshTick]);

  // Fetch inventory of selected SSU (for detail view)
  useEffect(() => {
    if (!selectedAddress) { setDetailData(null); return; }
    setDetailLoading(true);
    setDetailError(null);
    setDetailData(null);
    fetch(`/api/ssu-inventory?address=${encodeURIComponent(selectedAddress)}`)
      .then((r) => r.json().then((json) => ({ ok: r.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) throw new Error(json.error ?? "Error fetching inventory");
        setDetailData(json);
      })
      .catch((e) => setDetailError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => setDetailLoading(false));
  }, [selectedAddress]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "quantity" || key === "totalVolume" ? "desc" : "asc"); }
  }

  const sortedCombined = useMemo(() => {
    return [...combinedItems].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "groupName") cmp = a.groupName.localeCompare(b.groupName);
      else if (sortKey === "quantity") cmp = a.quantity - b.quantity;
      else if (sortKey === "totalVolume") cmp = (a.quantity * a.volume) - (b.quantity * b.volume);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [combinedItems, sortKey, sortDir]);

  const sortedDetailItems = useMemo(() => {
    if (!detailData) return [];
    return [...detailData.items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "groupName") cmp = a.groupName.localeCompare(b.groupName);
      else if (sortKey === "quantity") cmp = a.quantity - b.quantity;
      else if (sortKey === "totalVolume") cmp = (a.quantity * a.volume) - (b.quantity * b.volume);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [detailData, sortKey, sortDir]);

  const activeCount = ssus.filter((s) => !ignoredSet.has(s.address)).length;
  const totalCombinedVolume = combinedItems.reduce((sum, i) => sum + i.quantity * i.volume, 0);

  const detailCapacityPct = detailData && detailData.maxCapacity > 0
    ? Math.round((detailData.usedCapacity / detailData.maxCapacity) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Smart Storage Units</h2>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount} of {ssus.length} SSUs included in stock calculation
          </p>
        </div>
        <button
          onClick={() => setRefreshTick((t) => t + 1)}
          disabled={combinedLoading}
          className="btn-sm btn-secondary disabled:opacity-50"
          title="Refresh SSU stocks"
        >
          {combinedLoading ? "…" : "↻ Refresh"}
        </button>
      </div>

      {listLoading && <p className="text-xs text-gray-500">Looking for SSUs…</p>}
      {listError && <p className="text-xs text-red-400">{listError}</p>}

      {ssus.length > 0 && (
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-2 text-left">SSU</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-center" title="Include in stock calculation">Stock</th>
                <th className="px-4 py-2 text-right">Inventory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {ssus.map((ssu) => {
                const isActive = selectedAddress === ssu.address;
                const included = !ignoredSet.has(ssu.address);
                const offline = ssu.status !== "ONLINE";
                return (
                  <tr key={ssu.address} className={`transition-colors ${isActive ? "bg-gray-800/60" : "hover:bg-gray-900/50"}`}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-100">{ssu.displayName}</span>
                      <span className="ml-2 text-xs text-gray-600 font-mono">{ssu.address.slice(0, 10)}…</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        offline ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"
                      }`}>
                        {ssu.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Toggle
                        on={included}
                        onChange={() => toggleIgnored(ssu.address)}
                        title={
                          offline
                            ? included ? "OFFLINE — exclude when back online" : "OFFLINE — include when back online"
                            : included ? "Exclude from calculation" : "Include in calculation"
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setSelectedAddress(isActive ? null : ssu.address)}
                        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                          isActive
                            ? "border-cyan-600 text-cyan-300 bg-cyan-900/30"
                            : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                        }`}
                      >
                        {isActive ? "Close" : "View"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Combined stock card */}
      {(combinedLoading || combinedItems.length > 0 || activeCount > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">
              Combined stock
              {activeCount > 0 && (
                <span className="ml-2 text-xs text-gray-500 font-normal">({activeCount} active SSU{activeCount !== 1 ? "s" : ""})</span>
              )}
            </h3>
            {!combinedLoading && combinedItems.length > 0 && (
              <span className="text-xs text-gray-500">
                {combinedItems.length} tipos · {totalCombinedVolume.toLocaleString()} m³
              </span>
            )}
          </div>
          {combinedLoading
            ? <p className="text-sm text-gray-500">Loading stock…</p>
            : activeCount === 0
              ? <p className="text-sm text-gray-500">No active SSUs included in the calculation.</p>
              : <ItemTable items={sortedCombined} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          }
        </div>
      )}

      {/* Individual SSU detail */}
      {selectedAddress && (
        <div className="space-y-3 border-t border-gray-800 pt-4">
          <h3 className="text-sm font-semibold text-gray-300">SSU detail</h3>
          {detailLoading && <p className="text-sm text-gray-500">Loading inventory…</p>}
          {detailError && (
            <div className="rounded bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">{detailError}</div>
          )}
          {detailData && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-500 font-mono">{detailData.address}</span>
                    {detailData.name && <p className="text-base font-semibold text-gray-100 mt-0.5">{detailData.name}</p>}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    detailData.status === "ONLINE" ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
                  }`}>{detailData.status}</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Capacity</span>
                    <span>{detailData.usedCapacity.toLocaleString()} / {detailData.maxCapacity.toLocaleString()} m³ ({detailCapacityPct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-800">
                    <div
                      className={`h-1.5 rounded-full transition-all ${detailCapacityPct > 80 ? "bg-red-500" : detailCapacityPct > 50 ? "bg-yellow-500" : "bg-cyan-500"}`}
                      style={{ width: `${Math.min(detailCapacityPct, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {detailData.items.length} item types · {detailData.items.reduce((s, i) => s + i.quantity * i.volume, 0).toLocaleString()} m³ total
                </div>
              </div>
              <ItemTable items={sortedDetailItems} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
