import { NextRequest, NextResponse } from "next/server";
import { calculate, buildItemMap } from "@/lib/calculator";
import { fetchCalcItems, buildStockDeltas, applyStockDeltas } from "@/lib/calc-helpers";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId, runs } = await req.json();
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  if (!Number.isInteger(runs) || runs < 1) return NextResponse.json({ error: "runs must be a positive integer" }, { status: 400 });

  const itemMap = buildItemMap(await fetchCalcItems(session.userId));

  let result;
  try {
    const outputItem = itemMap.get(itemId);
    const blueprint = outputItem?.blueprints.find((b) => b.isDefault) ?? outputItem?.blueprints[0];
    const outputQty = blueprint?.outputQty ?? 1;
    const quantity = runs * outputQty;

    result = calculate([{ itemId, quantity }], itemMap);
    result.intermediates = result.intermediates.filter((i) => i.itemId !== itemId);
    result.finalProducts = [
      {
        itemId,
        itemName: outputItem?.name ?? itemId,
        quantityNeeded: quantity,
        outputQty,
        blueprintRuns: runs,
        actualStock: outputItem?.stock ?? 0,
      },
    ];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Calculation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const deltas = buildStockDeltas(result);
  await applyStockDeltas(deltas, session.userId);
  return NextResponse.json({ ok: true });
}
