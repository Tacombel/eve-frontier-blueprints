import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculate, buildItemMap } from "@/lib/calculator";
import { fetchCalcItems, buildStockDeltas } from "@/lib/calc-helpers";

export async function POST(req: NextRequest) {
  const { itemId, quantity } = await req.json();
  if (!itemId || !quantity) {
    return NextResponse.json({ error: "itemId and quantity required" }, { status: 400 });
  }

  const itemMap = buildItemMap(await fetchCalcItems());

  let result;
  try {
    result = calculate([{ itemId, quantity }], itemMap);
    result.intermediates = result.intermediates.filter((i) => i.itemId !== itemId);
    const outputItem = itemMap.get(itemId);
    result.finalProducts = [
      {
        itemId,
        itemName: outputItem?.name ?? itemId,
        quantityNeeded: quantity,
        actualStock: outputItem?.stock ?? 0,
      },
    ];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Calculation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const deltas = buildStockDeltas(result);

  await prisma.$transaction(
    [...deltas.entries()].map(([id, delta]) =>
      prisma.stock.upsert({
        where: { itemId: id },
        update: { quantity: { increment: delta } },
        create: { itemId: id, quantity: Math.max(0, delta) },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
