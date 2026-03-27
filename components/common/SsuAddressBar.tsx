"use client";

import { useState } from "react";

interface SsuAddressBarProps {
  address: string;
  onSave: (addr: string) => void;
  onRefresh?: () => void;
}

export default function SsuAddressBar({ address, onSave, onRefresh }: SsuAddressBarProps) {
  const [draft, setDraft] = useState(address);
  const [justSaved, setJustSaved] = useState(false);

  // Sync draft when address changes externally (initial load from DB)
  if (draft === "" && address !== "") {
    setDraft(address);
  }

  function commit() {
    if (draft.trim() === address) return;
    onSave(draft.trim());
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  return (
    <div className="flex items-center gap-2 rounded border border-gray-800 bg-gray-900/60 px-3 py-1.5">
      <span className="text-xs text-gray-500 shrink-0">SSU</span>
      <input
        type="text"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setJustSaved(false); }}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        placeholder="0x... (dirección del Smart Storage Unit)"
        className="flex-1 bg-transparent text-xs font-mono text-gray-300 placeholder-gray-600 focus:outline-none"
      />
      {justSaved && <span className="text-xs text-green-500 shrink-0">✓</span>}
      {onRefresh && (
        <button
          onClick={onRefresh}
          title="Refresh stock from SSU"
          className="text-gray-500 hover:text-gray-300 shrink-0 text-sm leading-none"
        >↻</button>
      )}
    </div>
  );
}
