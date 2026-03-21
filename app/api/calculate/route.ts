import { NextRequest, NextResponse } from "next/server";
import { calculate, buildItemMap } from "@/lib/calculator";
import { fetchCalcItems, enrichAsteroids } from "@/lib/calc-helpers";

export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId");
  const quantity = Number(req.nextUrl.searchParams.get("quantity") ?? "1");

  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  if (quantity < 1) return NextResponse.json({ error: "quantity must be >= 1" }, { status: 400 });

  const itemMap = buildItemMap(await fetchCalcItems());

  try {
    const result = calculate([{ itemId, quantity }], itemMap);

    // Move the output item from intermediates to finalProducts
    result.intermediates = result.intermediates.filter((i) => i.itemId !== itemId);
    const outputItem = itemMap.get(itemId);
    const blueprint = outputItem?.blueprints.find((b) => b.isDefault) ?? outputItem?.blueprints[0];
    result.finalProducts = [
      {
        itemId,
        itemName: outputItem?.name ?? itemId,
        quantityNeeded: quantity,
        actualStock: outputItem?.stock ?? 0,
        factory: blueprint?.factory || undefined,
        ignored: false,
      },
    ];

    await enrichAsteroids(result);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Calculation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
