import { NextRequest, NextResponse } from "next/server";
import { calculate, buildItemMap } from "@/lib/calculator";
import { fetchCalcItems, enrichAsteroids } from "@/lib/calc-helpers";
import { fetchUserStockMap } from "@/lib/sui";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId");
  const runs = Number(req.nextUrl.searchParams.get("runs") ?? "1");
  const excludedOres = req.nextUrl.searchParams.get("excludedOres");
  const excludedOreIds = excludedOres ? new Set(excludedOres.split(",").filter(Boolean)) : undefined;

  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  if (!Number.isInteger(runs) || runs < 1) return NextResponse.json({ error: "runs must be a positive integer" }, { status: 400 });

  const session = await getSession();
  const stockMap = session ? await fetchUserStockMap(session.userId) : new Map<string, number>();
  const itemMap = buildItemMap(await fetchCalcItems(stockMap));

  try {
    const outputItem = itemMap.get(itemId);
    const blueprint = outputItem?.blueprints.find((b) => b.isDefault) ?? outputItem?.blueprints[0];
    const outputQty = blueprint?.outputQty ?? 1;
    const quantity = runs * outputQty;

    const result = calculate([{ itemId, quantity }], itemMap, { excludedOreIds });

    // Move the output item from intermediates to finalProducts
    result.intermediates = result.intermediates.filter((i) => i.itemId !== itemId);
    result.finalProducts = [
      {
        itemId,
        itemName: outputItem?.name ?? itemId,
        quantityNeeded: quantity,
        outputQty,
        blueprintRuns: runs,
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
