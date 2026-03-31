import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMetrics } from "@/lib/metrics";

export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(getMetrics());
}
