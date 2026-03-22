"use client";

import { useState } from "react";

export default function AdminPage() {
  const [renormalizing, setRenormalizing] = useState(false);
  const [renormalizeResult, setRenormalizeResult] = useState<{ total: { renamed: number; duplicatesRemoved: number } } | null>(null);
  const [renormalizeError, setRenormalizeError] = useState("");

  async function runRenormalize() {
    setRenormalizing(true);
    setRenormalizeResult(null);
    setRenormalizeError("");
    const res = await fetch("/api/admin/renormalize", { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.error) setRenormalizeError(data.error ?? "Failed");
    else setRenormalizeResult(data);
    setRenormalizing(false);
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-100 mb-6">Admin</h1>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-1">Fix name capitalization</h2>
        <p className="text-sm text-gray-500 mb-4">
          Re-applies name normalization to all existing records.
          Removes duplicates caused by previous inconsistent capitalization (keeps the correctly-cased version).
        </p>
        <button onClick={runRenormalize} disabled={renormalizing} className="btn-sm btn-primary disabled:opacity-50">
          {renormalizing ? "Fixing…" : "Fix capitalization"}
        </button>
        {renormalizeError && (
          <div className="mt-4 rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">{renormalizeError}</div>
        )}
        {renormalizeResult && (
          <div className="mt-4 rounded border border-green-800 bg-green-900/20 px-4 py-3 text-sm">
            <p className="font-medium text-green-400">Done</p>
            <p className="text-xs text-gray-400 mt-1">{renormalizeResult.total.renamed} renamed · {renormalizeResult.total.duplicatesRemoved} duplicates removed</p>
          </div>
        )}
      </div>
    </div>
  );
}
