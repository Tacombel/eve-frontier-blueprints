"use client";

import { useState, useEffect } from "react";
import type { ImportPreview } from "@/app/api/admin/import/preview/route";

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

function PreviewSection({
  label,
  items,
  color,
}: {
  label: string;
  items: string[];
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`text-xs font-medium mb-1 ${color}`}>
        {label} ({items.length})
      </p>
      <ul className="text-xs text-gray-400 space-y-0.5">
        {items.map((name) => (
          <li key={name} className="truncate">{name}</li>
        ))}
      </ul>
    </div>
  );
}

function PreviewModal({
  preview,
  loading,
  onConfirm,
  onCancel,
}: {
  preview: ImportPreview | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const hasChanges = preview && (
    preview.factories.new.length > 0 ||
    preview.locations.new.length > 0 ||
    preview.items.new.length > 0 ||
    preview.items.updated.length > 0 ||
    preview.asteroidTypes.new.length > 0 ||
    preview.decompositions.new.length > 0 ||
    preview.blueprints.new.length > 0 ||
    preview.blueprints.updated.length > 0
  );

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Import preview</h2>
        <p className="text-sm text-gray-500 mb-4">
          Review the changes from <code className="text-cyan-400 bg-gray-800 px-1 rounded">seed.json</code> before applying.
        </p>

        {loading && <p className="text-gray-500 text-sm">Analysing seed.json…</p>}

        {preview && (
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {!hasChanges && (
              <div className="rounded bg-gray-800 px-4 py-3 text-sm text-gray-400">
                No changes detected — your database is already up to date.
              </div>
            )}

            {/* Items */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</p>
              <PreviewSection label="New" items={preview.items.new} color="text-green-400" />
              <PreviewSection label="Updated" items={preview.items.updated} color="text-yellow-400" />
              {preview.items.unchanged > 0 && (
                <p className="text-xs text-gray-600">{preview.items.unchanged} unchanged</p>
              )}
            </div>

            {/* Blueprints */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Blueprints</p>
              <PreviewSection label="New" items={preview.blueprints.new} color="text-green-400" />
              <PreviewSection label="Updated" items={preview.blueprints.updated} color="text-yellow-400" />
              {preview.blueprints.unchanged > 0 && (
                <p className="text-xs text-gray-600">{preview.blueprints.unchanged} unchanged</p>
              )}
            </div>

            {/* Factories */}
            {(preview.factories.new.length > 0) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Factories</p>
                <PreviewSection label="New" items={preview.factories.new} color="text-green-400" />
              </div>
            )}

            {/* Locations */}
            {preview.locations.new.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Locations</p>
                <PreviewSection label="New" items={preview.locations.new} color="text-green-400" />
              </div>
            )}

            {/* Asteroid types */}
            {preview.asteroidTypes.new.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Asteroid types</p>
                <PreviewSection label="New" items={preview.asteroidTypes.new} color="text-green-400" />
              </div>
            )}

            {/* Decompositions */}
            {preview.decompositions.new.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Decompositions</p>
                <PreviewSection label="New" items={preview.decompositions.new} color="text-green-400" />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="btn-ghost">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={loading || !preview}
            className="btn-primary disabled:opacity-50"
          >
            {hasChanges ? "Apply changes" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [seedStatus, setSeedStatus] = useState<"checking" | "up-to-date" | "updates-available" | "error">("checking");

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ActionResult | null>(null);
  const [importError, setImportError] = useState("");

  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ActionResult | null>(null);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    fetch("/api/admin/import/preview", { method: "POST" })
      .then((r) => r.json())
      .then((data: ImportPreview) => {
        const hasChanges =
          data.factories.new.length > 0 ||
          data.locations.new.length > 0 ||
          data.items.new.length > 0 ||
          data.items.updated.length > 0 ||
          data.asteroidTypes.new.length > 0 ||
          data.decompositions.new.length > 0 ||
          data.blueprints.new.length > 0 ||
          data.blueprints.updated.length > 0;
        setSeedStatus(hasChanges ? "updates-available" : "up-to-date");
      })
      .catch(() => setSeedStatus("error"));
  }, []);

  async function openPreview() {
    setShowPreview(true);
    setPreview(null);
    setPreviewLoading(true);
    setImportResult(null);
    setImportError("");
    const res = await fetch("/api/admin/import/preview", { method: "POST" });
    const data = await res.json();
    if (res.ok) setPreview(data);
    else setImportError(data.error ?? "Preview failed");
    setPreviewLoading(false);
  }

  async function applyImport(mode: "merge" | "reset") {
    setShowPreview(false);
    setImporting(true);
    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    if (!res.ok || data.error) setImportError(data.error ?? "Import failed");
    else { setImportResult(data); setSeedStatus("up-to-date"); }
    setImporting(false);
  }

  async function runReset() {
    if (!confirm("FULL RESET: this will delete ALL game data and reload from seed.json.\n\nYour stock will be preserved.\n\nContinue?")) return;
    setImporting(true);
    setImportResult(null);
    setImportError("");
    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "reset" }),
    });
    const data = await res.json();
    if (!res.ok || data.error) setImportError(data.error ?? "Reset failed");
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
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-100 mb-2">Admin</h1>
      <p className="text-gray-500 text-sm mb-4">Database management and collaboration tools.</p>

      {seedStatus === "checking" && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <span className="animate-spin">⟳</span> Checking seed.json for updates…
        </div>
      )}
      {seedStatus === "updates-available" && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-yellow-700 bg-yellow-900/20 px-4 py-2.5 text-sm text-yellow-300">
          <span>⚠</span>
          <span>seed.json has changes not yet applied to your database. Use <strong>Merge import</strong> to sync.</span>
        </div>
      )}
      {seedStatus === "up-to-date" && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-green-800 bg-green-900/20 px-4 py-2.5 text-sm text-green-400">
          <span>✓</span>
          <span>Your database is up to date with seed.json.</span>
        </div>
      )}
      {seedStatus === "error" && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-500">
          <span>—</span>
          <span>Could not read seed.json.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

        {/* Left column — actions */}
        <div className="space-y-4">
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

          {/* Import — merge with preview */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-base font-semibold text-gray-100 mb-1">Merge import</h2>
            <p className="text-sm text-gray-500 mb-4">
              Adds and updates data from{" "}
              <code className="text-cyan-400 bg-gray-800 px-1 rounded">prisma/seed.json</code>.
              Existing data not present in the seed is <strong className="text-gray-300">kept</strong>.
              Shows a preview before applying.
            </p>
            <button onClick={openPreview} disabled={importing} className="btn-primary disabled:opacity-50">
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
              onClick={runReset}
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

        {/* Right column — workflow */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 space-y-5 text-sm">
          <h2 className="text-base font-semibold text-gray-100">Collaboration workflow</h2>

          <div>
            <p className="text-cyan-400 font-medium mb-2">To contribute data</p>
            <ol className="text-gray-400 space-y-3 list-decimal list-inside">
              <li>Make your changes in the app (items, blueprints, etc.)</li>
              <li>Export to seed.json using the button on the left</li>
              <li className="list-none -ml-4">
                <span className="ml-4">Commit and open a Pull Request on GitHub:</span>
                <pre className="mt-2 bg-gray-800 rounded p-3 text-xs text-gray-300 overflow-x-auto">{`git add prisma/seed.json
git commit -m "feat: describe your changes"
git push
# Then open a Pull Request at:
# github.com/Tacombel/eve-frontier-blueprints/pulls`}</pre>
              </li>
            </ol>
          </div>

          <div className="border-t border-gray-800 pt-5">
            <p className="text-cyan-400 font-medium mb-2">To sync the latest data</p>
            <ol className="text-gray-400 space-y-2 list-decimal list-inside">
              <li>Pull the latest changes from GitHub (or ask the owner to merge your PR first)</li>
              <li>Use <strong className="text-gray-300">Merge import</strong> — preview what changes before applying</li>
            </ol>
          </div>

          <div className="border-t border-gray-800 pt-5">
            <p className="text-cyan-400 font-medium mb-2">Conflict notes</p>
            <ul className="text-gray-500 space-y-1 list-disc list-inside text-xs">
              <li>Always export before pulling to avoid losing local changes</li>
              <li>Merge import never deletes — safe for daily use</li>
              <li>Full reset only if you want an exact copy of the seed</li>
              <li>If two people add the same item name, the last merge wins</li>
            </ul>
          </div>
        </div>

      </div>

      {/* Preview modal */}
      {showPreview && (
        <PreviewModal
          preview={preview}
          loading={previewLoading}
          onConfirm={() => applyImport("merge")}
          onCancel={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
