import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSsuInventory } from "@/lib/sui";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  try {
    const inventory = await getSsuInventory(address);
    return NextResponse.json(inventory);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
