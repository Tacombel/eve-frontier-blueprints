"use client";

import { useState } from "react";

type ActionResult = {
  mode?: "merge" | "reset";
  counts: {
    factories: number;
    locations: number;
    items: number;
    asteroidTypes: number;
    decompositions: number;
    blueprints: number;
  };
};

function CountList({ counts }: { counts: ActionResult["counts"] }) {
  return (
    <ul className="text-xs text-gray-400 space-y-0.5 mt-1">
      <li>{counts.factories} factories</li>
      <li>{counts.locations} locations</li>
      <li>{counts.items} items</li>
      <li>{counts.asteroidTypes} asteroid types</li>
      <li>{counts.decompositions} decompositions</li>
      <li>{counts.blueprints} blueprints</li>
    </ul>
  );
}

export default function AdminPage() {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ActionResult | null>(null);
  const [importError, setImportError] = useState("");

  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ActionResult | null>(null);
  const [exportError, setExportError] = useState("");

  async function runImport(mode: "merge" | "reset") {
    const warning = mode === "reset"
      ? "FULL RESET: this will delete ALL game data and reload from seed.json.\n\nYour stock will be preserved.\n\nContinue?"
      : "This will add/update data from seed.json. Existing data not in the seed will be kept.\n\nContinue?";
    if (!confirm(warning)) return;
    setImporting(true);
    setImportResult(null);
    setImportError("");
    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
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
      <p className="text-gray-500 text-sm mb-6">Database management and collaboration tools.</p>

      {/* Collaboration workflow */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-3">Collaboration workflow</h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-cyan-400 font-medium mb-1">To contribute data</p>
            <ol className="text-gray-400 space-y-1 list-decimal list-inside">
              <li>Make your changes in the app (items, blueprints, etc.)</li>
              <li>Export to seed.json <span className="text-gray-600">(button below)</span></li>
              <li>Commit <code className="text-cyan-400 bg-gray-800 px-1 rounded">prisma/seed.json</code> and open a Pull Request on GitHub</li>
            </ol>
          </div>
          <div>
            <p className="text-cyan-400 font-medium mb-1">To sync the latest data</p>
            <ol className="text-gray-400 space-y-1 list-decimal list-inside">
              <li>Pull the latest changes on GitHub (or ask the owner to merge your PR first)</li>
              <li>Merge import <span className="text-gray-600">(button below)</span> to add new data without losing yours</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-1">Export to seed.json</h2>
        <p className="text-sm text-gray-500 mb-4">
          Saves current game data to{" "}
          <code className="text-cyan-400 bg-gray-800 px-1 rounded">prisma/seed.json</code>.
          Stock and packs are not exported.
        </p>
        <button onClick={runExport} disabled={exporting} className="btn-primary disabled:opacity-50">
          {exporting ? "Exporting…" : "⬆ Export to seed.json"}
        </button>
        {exportError && (
          <div className="mt-4 rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">{exportError}</div>
        )}
        {exportResult && (
          <div className="mt-4 rounded border border-green-800 bg-green-900/20 px-4 py-3">
            <p className="text-sm font-medium text-green-400">Export successful — commit and push seed.json to share</p>
            <CountList counts={exportResult.counts} />
          </div>
        )}
      </div>

      {/* Import — merge */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-1">Merge import</h2>
        <p className="text-sm text-gray-500 mb-4">
          Adds and updates data from{" "}
          <code className="text-cyan-400 bg-gray-800 px-1 rounded">prisma/seed.json</code>.
          Existing data not present in the seed is <strong className="text-gray-300">kept</strong>.
          Safe to use after pulling from GitHub.
        </p>
        <button onClick={() => runImport("merge")} disabled={importing} className="btn-primary disabled:opacity-50">
          {importing ? "Importing…" : "⬇ Merge from seed.json"}
        </button>
        {importError && (
          <div className="mt-4 rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">{importError}</div>
        )}
        {importResult?.mode === "merge" && (
          <div className="mt-4 rounded border border-green-800 bg-green-900/20 px-4 py-3">
            <p className="text-sm font-medium text-green-400">Merge successful</p>
            <CountList counts={importResult.counts} />
          </div>
        )}
      </div>

      {/* Import — full reset */}
      <div className="rounded-lg border border-red-900/40 bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-1">Full reset</h2>
        <p className="text-sm text-gray-500 mb-4">
          Deletes <strong className="text-red-400">all</strong> game data and reloads from{" "}
          <code className="text-cyan-400 bg-gray-800 px-1 rounded">prisma/seed.json</code>.
          Use only when you want a clean slate that exactly matches the seed.
          Stock is preserved.
        </p>
        <button
          onClick={() => runImport("reset")}
          disabled={importing}
          className="btn-sm bg-red-900 hover:bg-red-800 text-red-200 disabled:opacity-50"
        >
          {importing ? "Resetting…" : "⚠ Full reset from seed.json"}
        </button>
        {importResult?.mode === "reset" && (
          <div className="mt-4 rounded border border-green-800 bg-green-900/20 px-4 py-3">
            <p className="text-sm font-medium text-green-400">Reset successful</p>
            <CountList counts={importResult.counts} />
          </div>
        )}
      </div>
    </div>
  );
}
