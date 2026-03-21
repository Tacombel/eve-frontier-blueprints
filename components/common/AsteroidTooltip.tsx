import type { AsteroidInfo } from "@/lib/calculator";

export default function AsteroidTooltip({ asteroids }: { asteroids: AsteroidInfo[] }) {
  if (asteroids.length === 0) return null;
  return (
    <div className="absolute z-50 left-0 top-full mt-1 w-56 rounded border border-gray-700 bg-gray-900 shadow-lg p-2 text-xs pointer-events-none">
      {asteroids.map((a) => (
        <div key={a.name} className="mb-1 last:mb-0">
          <span className="text-cyan-300 font-medium">{a.name}</span>
          {a.locations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {a.locations.map((l) => (
                <span key={l} className="badge badge-blue">{l}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
