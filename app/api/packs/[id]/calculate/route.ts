import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculate, buildItemMap, CalcItem } from "@/lib/calculator";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ignoreParam = req.nextUrl.searchParams.get("ignore");
  const ignoredIds = new Set(ignoreParam ? ignoreParam.split(",").filter(Boolean) : []);

  const pack = await prisma.pack.findUnique({
    where: { id: params.id },
    include: { items: true },
  });

  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pack.items.length === 0) {
    return NextResponse.json({ rawMaterials: [], intermediates: [], decompositions: [], finalProducts: [] });
  }

  const allItems = await prisma.item.findMany({
    include: {
      stock: true,
      blueprints: {
        include: { inputs: { select: { itemId: true, quantity: true } } },
        orderBy: { isDefault: "desc" },
      },
      decomposition: {
        include: { outputs: { select: { itemId: true, quantity: true } } },
      },
    },
  });

  const calcItems: CalcItem[] = allItems.map((item) => ({
    id: item.id,
    name: item.name,
    isRawMaterial: item.isRawMaterial,
    isFound: item.isFound,
    stock: item.stock?.quantity ?? 0,
    blueprints: item.blueprints.map((bp) => ({
      id: bp.id,
      outputQty: bp.outputQty,
      factory: bp.factory,
      isDefault: bp.isDefault,
      inputs: bp.inputs,
    })),
    decomposition: item.decomposition
      ? { inputQty: item.decomposition.inputQty, outputs: item.decomposition.outputs }
      : null,
  }));

  const itemMap = buildItemMap(calcItems);

  try {
    const packItemIds = new Set(pack.items.map((pi) => pi.itemId));
    const activeItems = pack.items.filter((pi) => !ignoredIds.has(pi.itemId));
    const result = calculate(
      activeItems.map((pi) => ({ itemId: pi.itemId, quantity: pi.quantity })),
      itemMap
    );
    // Move pack items from intermediates to finalProducts so they get their own stock inputs
    result.intermediates = result.intermediates.filter((i) => !packItemIds.has(i.itemId));
    result.finalProducts = pack.items.map((pi) => {
      const item = itemMap.get(pi.itemId);
      const blueprint = item?.blueprints.find((b) => b.isDefault) ?? item?.blueprints[0];
      return {
        itemId: pi.itemId,
        itemName: item?.name ?? pi.itemId,
        quantityNeeded: pi.quantity,
        actualStock: item?.stock ?? 0,
        factory: blueprint?.factory || undefined,
        ignored: ignoredIds.has(pi.itemId),
      };
    });

    // Enrich ore (decomposition source items) with asteroid/location data
    if (result.decompositions.length > 0) {
      const oreItemIds = result.decompositions.map((d) => d.sourceItemId);
      const asteroidData = await prisma.itemAsteroidType.findMany({
        where: { itemId: { in: oreItemIds } },
        include: {
          asteroidType: {
            include: { locations: { include: { location: true } } },
          },
        },
      });
      const asteroidsByItem = new Map<string, { name: string; locations: string[] }[]>();
      for (const row of asteroidData) {
        const list = asteroidsByItem.get(row.itemId) ?? [];
        list.push({
          name: row.asteroidType.name,
          locations: row.asteroidType.locations.map((l) => l.location.name),
        });
        asteroidsByItem.set(row.itemId, list);
      }
      for (const d of result.decompositions) {
        const info = asteroidsByItem.get(d.sourceItemId);
        if (info) d.asteroids = info;
      }
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Calculation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
