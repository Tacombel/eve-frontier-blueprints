"use client";

import { useState } from "react";
import type { DecompositionResult, RawMaterialResult } from "@/lib/calculator";
import { computeOreSubstitution, type OreWithPico } from "@/lib/ore-optimization";
import AsteroidTooltip from "@/components/common/AsteroidTooltip";

interface OreSectionProps {
  decomps: DecompositionResult[];
  directOres: RawMaterialResult[];
  neededIds: Set<string>;
  cargoCapacity: number;
  onCargoChange: (v: number) => void;
  onExcludeOre?: (id: string, name: string) => void;
}

export default function OreSection({
  decomps,
  directOres,
  neededIds,
  cargoCapacity,
  onCargoChange,
  onExcludeOre,
}: OreSectionProps) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const foundDecomps = decomps.filter(d => !d.isUnrefined && d.sourceIsFound);
  const oreDecomps = decomps.filter(d => !d.isUnrefined && !d.sourceIsFound);

  if (oreDecomps.length === 0 && foundDecomps.length === 0 && directOres.length === 0) return null;

  // Units still pending to mine for each ore (after stock)
  const toMineMap = new Map<string, number>();
  for (const d of oreDecomps) {
    toMineMap.set(d.sourceItemId, Math.max(0, d.unitsToDecompose - d.actualStock));
  }

  const suggestion = computeOreSubstitution(oreDecomps, cargoCapacity, toMineMap, neededIds);

  // Compute picos for display using pending-to-mine volume
  const picoMap = new Map<string, OreWithPico>();
  if (cargoCapacity > 0) {
    for (const d of oreDecomps) {
      const unitsToMine = toMineMap.get(d.sourceItemId) ?? 0;
      const totalVolume = unitsToMine * d.volumePerUnit;
      const pico = totalVolume % cargoCapacity;
      picoMap.set(d.sourceItemId, {
        d,
        totalVolume,
        trips: unitsToMine > 0 ? Math.ceil(totalVolume / cargoCapacity) : 0,
        pico,
        spare: pico < 0.0001 ? 0 : cargoCapacity - pico,
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Raw Materials to Decompose (found/looted items that need refining) */}
      {foundDecomps.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-400 mb-2">Raw Materials to Decompose</h3>
          <div className="space-y-2">
            {foundDecomps.map((d) => {
              const totalNeeded = d.unitsToDecompose + (d.directNeed ?? 0);
              const stillNeeded = Math.max(0, totalNeeded - d.actualStock);
              return (
                <div key={d.sourceItemId} className="rounded border border-gray-800 bg-gray-800/40 p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-medium text-gray-200 flex-1">{d.sourceItemName}</span>
                    <div className="flex flex-col gap-0.5 text-xs text-gray-500">
                      {d.directNeed ? (
                        <span><span className="text-gray-300 font-semibold">{d.directNeed}</span> · for use in blueprints</span>
                      ) : null}
                      {d.unitsToDecompose > 0 && (
                        <span><span className="text-amber-300 font-semibold">{d.unitsToDecompose}</span> to refine · {d.runs} batch{d.runs > 1 ? "es" : ""} of {d.inputQty}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-300 font-medium w-24 text-right">{d.actualStock}</span>
                    <span className="text-xs text-gray-600">in stock</span>
                    <span className={`text-xs font-semibold w-16 text-right ${stillNeeded > 0 ? "text-red-400" : "text-green-400"}`}>
                      {stillNeeded > 0 ? `${stillNeeded} needed` : "✓"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 text-xs">
                    <span className="text-gray-600 self-center">→</span>
                    {d.outputs.map((o) => {
                      const needed = neededIds.has(o.itemId);
                      return needed ? (
                        <span key={o.itemId} className="bg-amber-900/40 border border-amber-700 rounded px-1.5 py-0.5 text-amber-200 font-medium">
                          {o.itemName} <span className="text-yellow-400">×{o.quantityObtained}</span>
                        </span>
                      ) : (
                        <span key={o.itemId} className="bg-gray-700 border border-gray-500 rounded px-1.5 py-0.5 text-gray-300">
                          {o.itemName} <span className="text-gray-400">×{o.quantityObtained}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ore to Decompose (mined ores) */}
      {(oreDecomps.length > 0 || directOres.length > 0) && (
      <div>
      {/* Header + cargo capacity input for Ore to Decompose */}
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-sm font-semibold text-purple-400 flex-1">Ore to Decompose</h3>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Cargo:</span>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="m³"
            className="input w-24 text-right py-0.5 text-xs"
            value={cargoCapacity || ""}
            onChange={(e) => onCargoChange(Math.max(0, Number(e.target.value)))}
          />
          <span className="text-gray-600">m³</span>
        </label>
      </div>

      {/* Trip optimization banner */}
      {!suggestion && cargoCapacity > 0 && oreDecomps.length >= 2 && (
        <div className="mb-3 rounded border border-gray-800 bg-gray-800/30 p-3 text-xs text-gray-500">
          💡 No trip optimization possible for this combination.
        </div>
      )}
      {suggestion && (
        <div className={`mb-3 rounded border p-3 text-xs ${
          suggestion.allFitInSpare
            ? "border-green-800 bg-green-900/20"
            : "border-yellow-800 bg-yellow-900/20"
        }`}>
          <p className={`font-semibold mb-2 ${suggestion.allFitInSpare ? "text-green-300" : "text-yellow-300"}`}>
            💡 Trip optimization
          </p>
          <p className="text-gray-400 mb-2">
            <span className="text-yellow-300">{suggestion.target.d.sourceItemName}</span> has{" "}
            <span className="font-semibold text-yellow-400">{suggestion.target.spare.toFixed(2)}</span> m³ free in its last trip
            ({suggestion.target.pico.toFixed(2)} m³ of {cargoCapacity} m³ used).
            Its materials can be covered by redistributing:
          </p>
          <div className="space-y-1">
            {suggestion.adjustments.map((adj) => (
              <div key={adj.ore.d.sourceItemId} className="flex items-center gap-2">
                <span className="text-gray-300 w-32 truncate">{adj.ore.d.sourceItemName}</span>
                <span className="text-gray-500">
                  {adj.ore.d.unitsToDecompose} → <span className="text-white font-semibold">{adj.newTotal}</span> u
                </span>
                <span className="text-gray-600">(+{adj.extraUnits} u)</span>
                {adj.fitsInSpare ? (
                  <span className="text-green-400">✓ fits in existing trip ({adj.ore.trips} trip{adj.ore.trips > 1 ? "s" : ""})</span>
                ) : (
                  <span className="text-yellow-400">{adj.ore.trips} → {adj.ore.trips + adj.extraTrips} trips (+{adj.extraTrips})</span>
                )}
              </div>
            ))}
          </div>
          {(() => {
            const totalTrips = oreDecomps.reduce((s, d) => {
                    const unitsToMine = toMineMap.get(d.sourceItemId) ?? 0;
                    return unitsToMine > 0 ? s + Math.ceil((unitsToMine * d.volumePerUnit) / cargoCapacity) : s;
                  }, 0);
            const extraTripsTotal = suggestion.adjustments.reduce((s, a) => s + a.extraTrips, 0);
            const saved = suggestion.target.trips - extraTripsTotal;
            const optimized = totalTrips - saved;
            return (
              <div className="mt-2 pt-2 border-t border-gray-700 flex items-center gap-3">
                <span className="text-gray-600">
                  Total trips: <span className="text-blue-400 font-semibold">{totalTrips}</span>
                  {saved > 0 && <span className="text-green-400"> → <span className="font-semibold">{optimized}</span></span>}
                </span>
                <span className="mx-4 text-gray-700">|</span>
                <span className="text-gray-500">
                  Remove <span className="text-yellow-300 font-semibold">{suggestion.target.trips}</span> trip{suggestion.target.trips > 1 ? "s" : ""} from {suggestion.target.d.sourceItemName}
                </span>
                {extraTripsTotal > 0 && (
                  <span className="text-gray-500">
                    +<span className="text-yellow-400 font-semibold">{extraTripsTotal}</span> extra
                  </span>
                )}
                <span className={saved > 0 ? "text-green-400 font-semibold" : "text-gray-500"}>
                  = <span className="font-bold">{saved > 0 ? `−${saved}` : saved}</span> trip{Math.abs(saved) !== 1 ? "s" : ""}
                </span>
              </div>
            );
          })()}
        </div>
      )}

      <div className="space-y-2">
        {oreDecomps.map((d) => {
          const op = picoMap.get(d.sourceItemId);
          const isTarget = suggestion?.target.d.sourceItemId === d.sourceItemId;
          return (
            <div
              key={d.sourceItemId}
              className={`rounded border p-3 ${
                isTarget ? "border-yellow-700 bg-yellow-900/20" : "border-gray-800 bg-gray-800/40"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span
                    className={`relative text-xs font-medium ${
                      isTarget ? "text-yellow-300" : "text-gray-200"
                    } ${d.asteroids?.length ? "cursor-help" : ""}`}
                    onMouseEnter={() => d.asteroids?.length && setHoveredItemId(d.sourceItemId)}
                    onMouseLeave={() => setHoveredItemId(null)}
                  >
                    {d.sourceItemName}
                    {d.asteroids?.length && <span className="ml-1 text-purple-400 text-xs">🪨</span>}
                    {isTarget && <span className="ml-1.5 text-yellow-500 text-xs">⚠ optimization candidate</span>}
                    {hoveredItemId === d.sourceItemId && d.asteroids?.length && (
                      <AsteroidTooltip asteroids={d.asteroids} />
                    )}
                  </span>
                  {onExcludeOre && (
                    <button
                      onClick={() => onExcludeOre(d.sourceItemId, d.sourceItemName)}
                      className="text-xs px-1.5 py-0.5 rounded border border-gray-600 text-gray-400 hover:border-red-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      title="Exclude this ore from calculation"
                    >
                      ⊗ Exclude
                    </button>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  Decompose <span className="text-purple-300 font-semibold">{d.unitsToDecompose}</span> units
                  · <span className="text-gray-300 font-semibold">{d.runs}</span> batch{d.runs > 1 ? "es" : ""}
                  <span className="text-gray-600"> of {d.inputQty} u</span>
                </span>
                <span className="text-xs text-gray-300 font-medium w-24 text-right">{d.actualStock}</span>
                <span className="text-xs text-gray-600">in stock</span>
                {(() => {
                  const toMine = Math.max(0, d.unitsToDecompose - d.actualStock);
                  return (
                    <div className="flex flex-col items-end w-32">
                      {toMine > 0
                        ? <span className="text-xs font-semibold text-red-400">⛏ {toMine}</span>
                        : <span className="text-xs font-semibold text-green-400">✓</span>}
                      {op && op.trips > 0 && toMine > 0 && (
                        <span className="text-xs text-blue-400"><span className="font-semibold">{op.trips}</span> trip{op.trips > 1 ? "s" : ""}</span>
                      )}
                      {op && op.totalVolume > 0 && toMine > 0 && (
                        <span className="text-xs text-gray-500">{op.totalVolume.toFixed(2)} m³</span>
                      )}
                      {op && op.spare > 0 && toMine > 0 && (
                        <span className="text-xs text-gray-600">
                          {op.spare.toFixed(2)} m³ free in last trip
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="flex flex-wrap gap-1 text-xs">
                <span className="text-gray-600 self-center">→</span>
                {d.outputs.map((o) => {
                  const needed = neededIds.has(o.itemId);
                  return needed ? (
                    <span key={o.itemId} className="bg-purple-900/60 border border-purple-700 rounded px-1.5 py-0.5 text-purple-200 font-medium">
                      {o.itemName} <span className="text-yellow-400">×{o.quantityObtained}</span>
                    </span>
                  ) : (
                    <span key={o.itemId} className="bg-gray-700 border border-gray-500 rounded px-1.5 py-0.5 text-gray-300">
                      {o.itemName} <span className="text-gray-400">×{o.quantityObtained}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {oreDecomps.length > 0 && (
        <div className="mt-2 flex flex-col items-end gap-0.5">
          <span className="text-sm text-gray-400">
            Total ore to decompose:{" "}
            <span className="text-purple-300 font-bold">
              {oreDecomps.reduce((sum, d) => sum + d.unitsToDecompose, 0).toLocaleString()}
            </span>{" "}
            units
          </span>
          {cargoCapacity > 0 && (() => {
            const totalTrips = oreDecomps.reduce((sum, d) => {
              const unitsToMine = toMineMap.get(d.sourceItemId) ?? 0;
              if (unitsToMine === 0) return sum;
              return sum + Math.ceil((unitsToMine * d.volumePerUnit) / cargoCapacity);
            }, 0);
            return (
              <span className="text-sm text-gray-400">
                Total trips: <span className="text-blue-400 font-bold">{totalTrips}</span>
              </span>
            );
          })()}
        </div>
      )}
      </div>
      )}
    </div>
  );
}
