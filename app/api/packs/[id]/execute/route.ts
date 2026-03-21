import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculate, buildItemMap } from "@/lib/calculator";
import { fetchCalcItems, buildStockDeltas } from "@/lib/calc-helpers";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ignoreParam = req.nextUrl.searchParams.get("ignore");
  const ignoredIds = new Set(ignoreParam ? ignoreParam.split(",").filter(Boolean) : []);

  const pack = await prisma.pack.findUnique({
    where: { id: params.id },
    include: { items: true },
  });
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pack.items.length === 0) return NextResponse.json({ error: "Pack has no items" }, { status: 400 });

  const itemMap = buildItemMap(await fetchCalcItems());
  const packItemIds = new Set(pack.items.map((pi) => pi.itemId));
  const activeItems = pack.items.filter((pi) => !ignoredIds.has(pi.itemId));

  let result;
  try {
    result = calculate(
      activeItems.map((pi) => ({ itemId: pi.itemId, quantity: pi.quantity })),
      itemMap
    );
    result.intermediates = result.intermediates.filter((i) => !packItemIds.has(i.itemId));
    result.finalProducts = activeItems.map((pi) => {
      const item = itemMap.get(pi.itemId);
      return {
        itemId: pi.itemId,
        itemName: item?.name ?? pi.itemId,
        quantityNeeded: pi.quantity,
        actualStock: item?.stock ?? 0,
      };
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Calculation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const deltas = buildStockDeltas(result);

  await prisma.$transaction(
    [...deltas.entries()].map(([itemId, delta]) =>
      prisma.stock.upsert({
        where: { itemId },
        update: { quantity: { increment: delta } },
        create: { itemId, quantity: Math.max(0, delta) },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
