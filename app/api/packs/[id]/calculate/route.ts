import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculate, buildItemMap } from "@/lib/calculator";
import { fetchCalcItems, enrichAsteroids } from "@/lib/calc-helpers";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ignoreParam = req.nextUrl.searchParams.get("ignore");
  const ignoredIds = new Set(ignoreParam ? ignoreParam.split(",").filter(Boolean) : []);

  const pack = await prisma.pack.findUnique({
    where: { id: params.id },
    include: { items: true },
  });

  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pack.userId !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (pack.items.length === 0) {
    return NextResponse.json({ rawMaterials: [], intermediates: [], decompositions: [], finalProducts: [] });
  }

  const itemMap = buildItemMap(await fetchCalcItems(session.userId));

  try {
    const packItemIds = new Set(pack.items.map((pi) => pi.itemId));
    const activeItems = pack.items.filter((pi) => !ignoredIds.has(pi.itemId));
    const result = calculate(
      activeItems.map((pi) => ({ itemId: pi.itemId, quantity: pi.quantity })),
      itemMap
    );

    result.intermediates = result.intermediates.filter((i) => !packItemIds.has(i.itemId));
    result.finalProducts = pack.items.map((pi) => {
      const item = itemMap.get(pi.itemId);
      const blueprint = item?.blueprints.find((b) => b.isDefault) ?? item?.blueprints[0];
      const outputQty = blueprint?.outputQty ?? 1;
      return {
        itemId: pi.itemId,
        itemName: item?.name ?? pi.itemId,
        quantityNeeded: pi.quantity,
        outputQty,
        blueprintRuns: Math.ceil(pi.quantity / outputQty),
        actualStock: item?.stock ?? 0,
        factory: blueprint?.factory || undefined,
        ignored: ignoredIds.has(pi.itemId),
      };
    });

    await enrichAsteroids(result);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Calculation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
