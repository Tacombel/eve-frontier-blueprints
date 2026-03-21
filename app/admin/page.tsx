"use client";

import { useState } from "react";

type ImportResult = {
  counts: {
    factories: number;
    locations: number;
    items: number;
    asteroidTypes: number;
    decompositions: number;
    blueprints: number;
  };
};

export default function AdminPage() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  async function runImport() {
    if (!confirm("This will reset all game data (items, blueprints, factories, decompositions, asteroids) and reload from seed.json.\n\nYour stock will be preserved.\n\nContinue?")) return;
    setImporting(true);
    setResult(null);
    setError("");
    const res = await fetch("/api/admin/import", { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.error) {
      setError(data.error ?? "Import failed");
    } else {
      setResult(data);
    }
    setImporting(false);
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-100 mb-2">Admin</h1>
      <p className="text-gray-500 text-sm mb-8">Database management tools.</p>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-1">Import seed data</h2>
        <p className="text-sm text-gray-500 mb-4">
          Reloads game data from <code className="text-cyan-400 bg-gray-800 px-1 rounded">prisma/seed.json</code>.
          Pull the latest changes from GitHub first, then run this to sync your local database.
          Stock and packs are not affected.
        </p>

        <button
          onClick={runImport}
          disabled={importing}
          className="btn-primary disabled:opacity-50"
        >
          {importing ? "Importing…" : "⬇ Import from seed.json"}
        </button>

        {error && (
          <div className="mt-4 rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 rounded border border-green-800 bg-green-900/20 px-4 py-3">
            <p className="text-sm font-medium text-green-400 mb-2">Import successful</p>
            <ul className="text-xs text-gray-400 space-y-0.5">
              <li>{result.counts.factories} factories</li>
              <li>{result.counts.locations} locations</li>
              <li>{result.counts.items} items</li>
              <li>{result.counts.asteroidTypes} asteroid types</li>
              <li>{result.counts.decompositions} decompositions</li>
              <li>{result.counts.blueprints} blueprints</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
