/**
 * Compares legacy prisma/seed.json against the new data/game-data.json.
 * Shows items/blueprints/decompositions added, removed, or changed.
 *
 * Usage: npm run db:compare
 */
import { readFileSync } from "fs";
import { join } from "path";

const cwd = process.cwd();

const legacy = JSON.parse(readFileSync(join(cwd, "prisma/seed.json"), "utf-8"));
const current = JSON.parse(readFileSync(join(cwd, "data/game-data.json"), "utf-8"));

let totalDiffs = 0;

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

function diff<T>(label: string, legacyArr: T[], currentArr: T[], key: (x: T) => string, detail?: (x: T) => string) {
  const legacyMap = new Map(legacyArr.map((x) => [key(x), x]));
  const currentMap = new Map(currentArr.map((x) => [key(x), x]));

  const added = currentArr.filter((x) => !legacyMap.has(key(x)));
  const removed = legacyArr.filter((x) => !currentMap.has(key(x)));

  if (added.length === 0 && removed.length === 0) {
    console.log(`  ${label}: ✓ igual (${legacyArr.length})`);
    return;
  }

  console.log(`  ${label}: ${legacyArr.length} → ${currentArr.length}`);
  for (const x of added) {
    console.log(`    + ${key(x)}${detail ? "  " + detail(x) : ""}`);
    totalDiffs++;
  }
  for (const x of removed) {
    console.log(`    - ${key(x)}${detail ? "  " + detail(x) : ""}`);
    totalDiffs++;
  }
}

section("Factories");
diff(
  "factories",
  legacy.factories.map((n: string) => ({ name: n })),
  current.factories.map((n: string) => ({ name: n })),
  (x: { name: string }) => x.name
);

section("Refineries");
const legacyRefineries: string[] = legacy.refineries ?? [];
diff(
  "refineries",
  legacyRefineries.map((n) => ({ name: n })),
  current.refineries.map((n: string) => ({ name: n })),
  (x: { name: string }) => x.name
);

section("Locations");
diff(
  "locations",
  legacy.locations.map((n: string) => ({ name: n })),
  current.locations.map((n: string) => ({ name: n })),
  (x: { name: string }) => x.name
);

section("Items");
diff<{ name: string; isRawMaterial: boolean; isFound: boolean; isFinalProduct: boolean }>(
  "items",
  legacy.items,
  current.items,
  (x) => x.name,
  (x) => {
    const flags = [];
    if (x.isRawMaterial) flags.push("raw");
    if (x.isFound) flags.push("found");
    if (x.isFinalProduct) flags.push("final");
    return `[${flags.join(", ") || "intermediate"}]`;
  }
);

// Detect changed item flags
const legacyItemMap = new Map(legacy.items.map((i: { name: string }) => [i.name, i]));
const currentItemMap = new Map(current.items.map((i: { name: string }) => [i.name, i]));
const changed: string[] = [];
for (const [name, cur] of currentItemMap.entries()) {
  const leg = legacyItemMap.get(name) as { isRawMaterial: boolean; isFound: boolean; isFinalProduct: boolean } | undefined;
  if (!leg) continue;
  const c = cur as { isRawMaterial: boolean; isFound: boolean; isFinalProduct: boolean };
  if (leg.isRawMaterial !== c.isRawMaterial || leg.isFound !== c.isFound || leg.isFinalProduct !== c.isFinalProduct) {
    changed.push(
      `  ~ ${name}: [${leg.isRawMaterial ? "raw" : ""}${leg.isFound ? "found" : ""}${leg.isFinalProduct ? "final" : ""}] → [${c.isRawMaterial ? "raw" : ""}${c.isFound ? "found" : ""}${c.isFinalProduct ? "final" : ""}]`
    );
    totalDiffs++;
  }
}
if (changed.length > 0) {
  console.log("  Flags modificados:");
  changed.forEach((l) => console.log(l));
}

section("Blueprints");
diff<{ outputItem: string; factory: string; outputQty: number; inputs: { item: string; quantity: number }[] }>(
  "blueprints",
  legacy.blueprints,
  current.blueprints,
  (x) => `${x.outputItem} @ ${x.factory}`,
  (x) =>
    `→ ${x.outputQty}x  [${x.inputs.map((i) => `${i.quantity}x ${i.item}`).join(", ")}]`
);

section("Decompositions");
diff<{ sourceItem: string; refinery?: string; inputQty: number; outputs: { item: string; quantity: number }[] }>(
  "decompositions",
  legacy.decompositions,
  current.decompositions,
  (x) => `${x.sourceItem}${x.refinery ? " @ " + x.refinery : ""}`,
  (x) =>
    `${x.inputQty}x → [${x.outputs.map((o) => `${o.quantity}x ${o.item}`).join(", ")}]`
);

section("Asteroid Types");
diff(
  "asteroidTypes",
  legacy.asteroidTypes,
  current.asteroidTypes,
  (x: { name: string }) => x.name
);

console.log(`\n${"═".repeat(60)}`);
if (totalDiffs === 0) {
  console.log("  ✓ Sin diferencias");
} else {
  console.log(`  ${totalDiffs} diferencia(s) encontrada(s)`);
}
console.log("═".repeat(60) + "\n");
