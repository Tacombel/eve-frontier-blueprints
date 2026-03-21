"use client";

import { useState } from "react";

type ActionResult = {
  counts: {
    factories: number;
    locations: number;
    items: number;
    asteroidTypes: number;
    decompositions: number;
    blueprints: number;
  };
};

function ResultBox({ result, label }: { result: ActionResult; label: string }) {
  return (
    <div className="mt-4 rounded border border-green-800 bg-green-900/20 px-4 py-3">
      <p className="text-sm font-medium text-green-400 mb-2">{label}</p>
      <ul className="text-xs text-gray-400 space-y-0.5">
        <li>{result.counts.factories} factories</li>
        <li>{result.counts.locations} locations</li>
        <li>{result.counts.items} items</li>
        <li>{result.counts.asteroidTypes} asteroid types</li>
        <li>{result.counts.decompositions} decompositions</li>
        <li>{result.counts.blueprints} blueprints</li>
      </ul>
    </div>
  );
}

export default function AdminPage() {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ActionResult | null>(null);
  const [importError, setImportError] = useState("");

  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ActionResult | null>(null);
  const [exportError, setExportError] = useState("");

  async function runImport() {
    if (!confirm("This will reset all game data (items, blueprints, factories, decompositions, asteroids) and reload from seed.json.\n\nYour stock will be preserved.\n\nContinue?")) return;
    setImporting(true);
    setImportResult(null);
    setImportError("");
    const res = await fetch("/api/admin/import", { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.error) setImportError(data.error ?? "Import failed");
    else setImportResult(data);
    setImporting(false);
  }

  async function runExport() {
    setExporting(true);
    setExportResult(null);
    setExportError("");
    const res = await fetch("/api/admin/export", { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.error) setExportError(data.error ?? "Export failed");
    else setExportResult(data);
    setExporting(false);
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-100 mb-2">Admin</h1>
      <p className="text-gray-500 text-sm mb-8">Database management tools.</p>

      {/* Export */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-1">Export to seed.json</h2>
        <p className="text-sm text-gray-500 mb-4">
          Saves the current game data to{" "}
          <code className="text-cyan-400 bg-gray-800 px-1 rounded">prisma/seed.json</code>.
          Commit and push that file to GitHub to share your data with others.
          Stock and packs are not exported.
        </p>
        <button onClick={runExport} disabled={exporting} className="btn-primary disabled:opacity-50">
          {exporting ? "Exporting…" : "⬆ Export to seed.json"}
        </button>
        {exportError && (
          <div className="mt-4 rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {exportError}
          </div>
        )}
        {exportResult && <ResultBox result={exportResult} label="Export successful" />}
      </div>

      {/* Import */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-1">Import from seed.json</h2>
        <p className="text-sm text-gray-500 mb-4">
          Reloads game data from{" "}
          <code className="text-cyan-400 bg-gray-800 px-1 rounded">prisma/seed.json</code>.
          Pull the latest changes from GitHub first, then run this to sync your local database.
          Stock and packs are not affected.
        </p>
        <button onClick={runImport} disabled={importing} className="btn-primary disabled:opacity-50">
          {importing ? "Importing…" : "⬇ Import from seed.json"}
        </button>
        {importError && (
          <div className="mt-4 rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {importError}
          </div>
        )}
        {importResult && <ResultBox result={importResult} label="Import successful" />}
      </div>
    </div>
  );
}
