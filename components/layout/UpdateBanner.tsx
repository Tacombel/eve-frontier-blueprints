"use client";

import { useEffect, useState } from "react";

type CheckResult =
  | { upToDate: true; localCommit: string; remoteCommit: string }
  | { upToDate: false; localCommit: string; remoteCommit: string }
  | { error: string };

export default function UpdateBanner() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/version-check")
      .then((r) => r.json())
      .then((data: CheckResult) => setResult(data))
      .catch(() => {/* silently ignore */});
  }, []);

  if (!result || dismissed) return null;
  if ("error" in result) return null;
  if (result.upToDate) return null;

  return (
    <div className="flex items-start gap-3 bg-yellow-900/60 border border-yellow-700 text-yellow-200 text-sm px-4 py-3">
      <span className="text-yellow-400 text-base mt-0.5">⚠</span>
      <div className="flex-1">
        <span className="font-semibold">Update available</span>
        <span className="text-yellow-300 ml-2 font-mono text-xs">
          {result.localCommit} → {result.remoteCommit}
        </span>
        <div className="mt-1 text-yellow-300/80">
          Run <code className="bg-yellow-950/60 px-1 rounded font-mono">git pull</code> in the project folder,
          then go to{" "}
          <strong>Admin → Merge import</strong> to apply the latest data.
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-yellow-500 hover:text-yellow-200 text-lg leading-none mt-0.5"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
