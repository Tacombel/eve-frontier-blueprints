import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function POST() {
  try {
    const [factories, locations, items, asteroidTypes, decompositions, blueprints] =
      await Promise.all([
        prisma.factory.findMany({ orderBy: { name: "asc" } }),
        prisma.location.findMany({ orderBy: { name: "asc" } }),
        prisma.item.findMany({ orderBy: { name: "asc" } }),
        prisma.asteroidType.findMany({
          include: {
            locations: { include: { location: true } },
            items: { include: { item: true } },
          },
          orderBy: { name: "asc" },
        }),
        prisma.decomposition.findMany({
          include: {
            sourceItem: true,
            outputs: { include: { item: true }, orderBy: { quantity: "desc" } },
          },
          orderBy: { sourceItem: { name: "asc" } },
        }),
        prisma.blueprint.findMany({
          include: {
            outputItem: true,
            inputs: { include: { item: true }, orderBy: { quantity: "desc" } },
          },
          orderBy: [{ outputItem: { name: "asc" } }, { isDefault: "desc" }],
        }),
      ]);

    const seed = {
      factories: factories.map((f) => f.name),
      locations: locations.map((l) => l.name),
      items: items.map((i) => ({
        name: i.name,
        isRawMaterial: i.isRawMaterial,
        isFound: i.isFound,
        isFinalProduct: i.isFinalProduct,
      })),
      asteroidTypes: asteroidTypes.map((at) => ({
        name: at.name,
        locations: at.locations.map((l) => l.location.name).sort(),
        items: at.items.map((i) => i.item.name).sort(),
      })),
      decompositions: decompositions.map((d) => ({
        sourceItem: d.sourceItem.name,
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

    const seedPath = path.join(process.cwd(), "prisma/seed.json");
    fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + "\n");

    return NextResponse.json({
      ok: true,
      counts: {
        factories: seed.factories.length,
        locations: seed.locations.length,
        items: seed.items.length,
        asteroidTypes: seed.asteroidTypes.length,
        decompositions: seed.decompositions.length,
        blueprints: seed.blueprints.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
