"use client";

import type { SsuSummary } from "@/hooks/useSsuList";

interface Props {
  ssus: SsuSummary[];
  ignoredSet: Set<string>;
  toggleIgnored: (address: string) => void;
}

export default function SsuSelector({ ssus, ignoredSet, toggleIgnored }: Props) {
  if (ssus.length === 0) return null;

  const activeCount = ssus.filter((s) => !ignoredSet.has(s.address)).length;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">SSU Stock</span>
        <span className="text-xs text-gray-600">{activeCount} of {ssus.length} active</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {ssus.map((ssu) => {
          const included = !ignoredSet.has(ssu.address);
          const offline = ssu.status !== "ONLINE";
          return (
            <label
              key={ssu.address}
              className="flex items-center gap-1.5 cursor-pointer select-none"
              title={offline ? (included ? "OFFLINE — exclude when back online" : "OFFLINE — include when back online") : (included ? "Exclude from calculation" : "Include in calculation")}
            >
              <button
                type="button"
                onClick={() => toggleIgnored(ssu.address)}
                className={`relative inline-flex h-3.5 w-7 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${included ? "bg-cyan-600" : "bg-gray-600"}`}
              >
                <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ${included ? "translate-x-3" : "translate-x-0"}`} />
              </button>
              <span className={`text-xs ${included ? "text-gray-300" : "text-gray-600"}`}>
                {ssu.displayName}
              </span>
              <span className={`text-xs ${offline ? "text-red-500" : "text-green-500"}`}>●</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
