/**
 * Exports the current static tables from SQLite → data/game-data.json
 * Use in dev after editing via admin UI to persist changes to the repo.
 *
 * Usage: npm run db:export
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Exporting static data from DB → data/game-data.json...");

  const factories = await prisma.factory.findMany({ orderBy: { name: "asc" } });
  const refineries = await prisma.refinery.findMany({ orderBy: { name: "asc" } });
  const locations = await prisma.location.findMany({ orderBy: { name: "asc" } });
  const items = await prisma.item.findMany({ orderBy: { name: "asc" } });
  const asteroidTypes = await prisma.asteroidType.findMany({
    orderBy: { name: "asc" },
    include: {
      locations: { include: { location: true } },
      items: { include: { item: true } },
    },
  });
  const decompositions = await prisma.decomposition.findMany({
    include: { sourceItem: true, outputs: { include: { item: true } } },
    orderBy: [{ sourceItem: { name: "asc" } }, { refinery: "asc" }],
  });
  const blueprints = await prisma.blueprint.findMany({
    include: { outputItem: true, inputs: { include: { item: true } } },
    orderBy: [{ outputItem: { name: "asc" } }, { factory: "asc" }],
  });

  const data = {
    factories: factories.map((f) => f.name),
    refineries: refineries.map((r) => r.name),
    locations: locations.map((l) => l.name),
    items: items.map((i) => ({
      name: i.name,
      isRawMaterial: i.isRawMaterial,
      isFound: i.isFound,
      isFinalProduct: i.isFinalProduct,
      ...(i.volume ? { volume: i.volume } : {}),
    })),
    asteroidTypes: asteroidTypes.map((at) => ({
      name: at.name,
      locations: at.locations.map((l) => l.location.name).sort(),
      items: at.items.map((i) => i.item.name).sort(),
    })),
    decompositions: decompositions.map((d) => ({
      sourceItem: d.sourceItem.name,
      ...(d.refinery ? { refinery: d.refinery } : {}),
      inputQty: d.inputQty,
      outputs: d.outputs.map((o) => ({ item: o.item.name, quantity: o.quantity })),
    })),
    blueprints: blueprints.map((bp) => ({
      outputItem: bp.outputItem.name,
      factory: bp.factory,
      outputQty: bp.outputQty,
      isDefault: bp.isDefault,
      inputs: bp.inputs.map((i) => ({ item: i.item.name, quantity: i.quantity })),
    })),
  };

  const outPath = join(process.cwd(), "data/game-data.json");
  writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n");

  console.log(`  ✓ ${data.factories.length} factories`);
  console.log(`  ✓ ${data.refineries.length} refineries`);
  console.log(`  ✓ ${data.locations.length} locations`);
  console.log(`  ✓ ${data.items.length} items`);
  console.log(`  ✓ ${data.asteroidTypes.length} asteroid types`);
  console.log(`  ✓ ${data.decompositions.length} decompositions`);
  console.log(`  ✓ ${data.blueprints.length} blueprints`);
  console.log(`Written to ${outPath}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
