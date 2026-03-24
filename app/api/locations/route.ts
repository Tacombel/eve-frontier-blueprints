import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { requireAdmin } from "@/lib/auth";
import { requireDev } from "@/lib/dev-guard";

export async function GET() {
  const locations = await prisma.location.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(locations);
}

export async function POST(req: NextRequest) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const location = await prisma.location.create({ data: { name: normalizeName(name) } });
  return NextResponse.json(location, { status: 201 });
}
