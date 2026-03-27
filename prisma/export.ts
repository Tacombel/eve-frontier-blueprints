import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { writeFileSync, copyFileSync, existsSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient();
const SEED_PATH = resolve(__dirname, "seed.json");
const BACKUP_PATH = resolve(__dirname, "seed.json.bak");

// Minimum records expected per section — protects against exporting an empty/broken DB
const MINIMUMS = {
  facilities: 5,
  locations: 5,
  items: 50,
  asteroidTypes: 1,
  decompositions: 1,
  blueprints: 1,
};

async function main() {
  console.log("Exporting database to seed.json...");

  const [factories, refineries, locations, items, asteroidTypes, decompositions, blueprints] =
    await Promise.all([
      prisma.factory.findMany({ orderBy: { name: "asc" } }),
      prisma.refinery.findMany({ orderBy: { name: "asc" } }),
      prisma.location.findMany({ orderBy: { name: "asc" } }),
      prisma.item.findMany({ orderBy: { name: "asc" } }),
      prisma.asteroidType.findMany({
        orderBy: { name: "asc" },
        include: {
          locations: { include: { location: true } },
          items: { include: { item: true } },
        },
      }),
      prisma.decomposition.findMany({
        include: {
          sourceItem: true,
          outputs: { include: { item: true } },
        },
        orderBy: { sourceItem: { name: "asc" } },
      }),
      prisma.blueprint.findMany({
        include: {
          outputItem: true,
          inputs: { include: { item: true } },
        },
        orderBy: { outputItem: { name: "asc" } },
      }),
    ]);

  const facilitiesData = [
    ...factories.map((f) => ({ name: f.name, type: "factory" as const })),
    ...refineries.map((r) => ({ name: r.name, type: "refinery" as const })),
  ];

  const data = {
    facilities: facilitiesData,
    locations: locations.map((l) => l.name),
    items: items.map((i) => ({
      name: i.name,
      typeId: i.typeId,
      isRawMaterial: i.isRawMaterial,
      isFound: i.isFound,
      isFinalProduct: i.isFinalProduct,
      volume: i.volume,
      ...(i.description ? { description: i.description } : {}),
      ...(i.mass !== null ? { mass: i.mass } : {}),
      ...(i.radius !== null ? { radius: i.radius } : {}),
      ...(i.portionSize !== null ? { portionSize: i.portionSize } : {}),
      ...(i.groupName ? { groupName: i.groupName } : {}),
      ...(i.groupId !== null ? { groupId: i.groupId } : {}),
      ...(i.categoryName ? { categoryName: i.categoryName } : {}),
      ...(i.categoryId !== null ? { categoryId: i.categoryId } : {}),
      ...(i.iconUrl ? { iconUrl: i.iconUrl } : {}),
    })),
    asteroidTypes: asteroidTypes.map((at) => ({
      name: at.name,
      locations: at.locations.map((l) => l.location.name).sort(),
      items: at.items.map((i) => i.item.name).sort(),
    })),
    decompositions: decompositions.map((d) => ({
      sourceItem: d.sourceItem.name,
      facility: d.refinery,
      inputQty: d.inputQty,
      runTime: d.runTime,
      outputs: d.outputs.map((o) => ({ item: o.item.name, quantity: o.quantity })),
    })),
    blueprints: blueprints.map((bp) => ({
      outputItem: bp.outputItem.name,
      facility: bp.factory,
      outputQty: bp.outputQty,
      runTime: bp.runTime,
      inputs: bp.inputs.map((i) => ({ item: i.item.name, quantity: i.quantity })),
    })),
  };

  // Validate minimums before touching anything
  const counts = {
    facilities: data.facilities.length,
    locations: data.locations.length,
    items: data.items.length,
    asteroidTypes: data.asteroidTypes.length,
    decompositions: data.decompositions.length,
    blueprints: data.blueprints.length,
  };

  const failures = (Object.keys(MINIMUMS) as (keyof typeof MINIMUMS)[]).filter(
    (key) => counts[key] < MINIMUMS[key]
  );

  if (failures.length > 0) {
    console.error("❌ Export aborted — database looks incomplete:");
    for (const key of failures) {
      console.error(`   ${key}: got ${counts[key]}, expected at least ${MINIMUMS[key]}`);
    }
    console.error("   seed.json has NOT been modified.");
    process.exit(1);
  }

  // Backup current seed.json before overwriting
  if (existsSync(SEED_PATH)) {
    copyFileSync(SEED_PATH, BACKUP_PATH);
    console.log("  ✓ Backup saved to seed.json.bak");
  }

  writeFileSync(SEED_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");

  console.log(
    `  ✓ Exported: ${counts.facilities} facilities, ${counts.locations} locations, ` +
      `${counts.items} items, ${counts.asteroidTypes} asteroid types, ` +
      `${counts.decompositions} decompositions, ${counts.blueprints} blueprints`
  );
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error("❌ Export failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
