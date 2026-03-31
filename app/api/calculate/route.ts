import { NextRequest, NextResponse } from "next/server";
import { calculate, buildItemMap } from "@/lib/calculator";
import { fetchCalcItems, enrichAsteroids } from "@/lib/calc-helpers";
import { fetchUserStockMap, fetchStockMapFromAddresses } from "@/lib/sui";
import { getSession } from "@/lib/auth";
import { recordRequest } from "@/lib/metrics";

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const itemId = req.nextUrl.searchParams.get("itemId");
  const units = Number(req.nextUrl.searchParams.get("units") ?? "1");
  const excludedOres = req.nextUrl.searchParams.get("excludedOres");
  const excludedOreIds = excludedOres ? new Set(excludedOres.split(",").filter(Boolean)) : undefined;

  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  if (!Number.isInteger(units) || units < 1) return NextResponse.json({ error: "units must be a positive integer" }, { status: 400 });

  const ssuAddressesParam = req.nextUrl.searchParams.get("ssuAddresses");
  const session = await getSession();
  const stockMap = ssuAddressesParam
    ? await fetchStockMapFromAddresses(ssuAddressesParam.split(",").filter(Boolean))
    : session
    ? await fetchUserStockMap(session.userId)
    : new Map<string, number>();
  const itemMap = buildItemMap(await fetchCalcItems(stockMap));

  try {
    const outputItem = itemMap.get(itemId);
    const blueprint = outputItem?.blueprints.find((b) => b.isDefault) ?? outputItem?.blueprints[0];
    const outputQty = blueprint?.outputQty ?? 1;
    const runs = Math.ceil(units / outputQty);
    const quantity = runs * outputQty;

    const result = calculate([{ itemId, quantity }], itemMap, { excludedOreIds });

    // Move the output item from intermediates to finalProducts
    result.intermediates = result.intermediates.filter((i) => i.itemId !== itemId);
    result.finalProducts = [
      {
        itemId,
        itemName: outputItem?.name ?? itemId,
        quantityNeeded: units,
        outputQty,
        blueprintRuns: runs,
        actualStock: outputItem?.stock ?? 0,
        factory: blueprint?.factory || undefined,
        ignored: false,
      },
    ];

    await enrichAsteroids(result);

    recordRequest("calculate", Date.now() - t0, true);
    return NextResponse.json(result);
  } catch (err: unknown) {
    recordRequest("calculate", Date.now() - t0, false);
    const message = err instanceof Error ? err.message : "Calculation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
