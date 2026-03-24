import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { requireAdmin } from "@/lib/auth";
import { requireDev } from "@/lib/dev-guard";

export async function GET() {
  const refineries = await prisma.refinery.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(refineries);
}

export async function POST(req: NextRequest) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const refinery = await prisma.refinery.create({ data: { name: normalizeName(name) } });
    return NextResponse.json(refinery, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isUnique = msg.includes("Unique constraint");
    return NextResponse.json({ error: isUnique ? "Name already exists" : msg }, { status: 409 });
  }
}
