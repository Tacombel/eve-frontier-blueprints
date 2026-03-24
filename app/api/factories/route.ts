import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { requireAdmin } from "@/lib/auth";
import { requireDev } from "@/lib/dev-guard";

export async function GET() {
  const factories = await prisma.factory.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(factories);
}

export async function POST(req: NextRequest) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const factory = await prisma.factory.create({ data: { name: normalizeName(name) } });
    return NextResponse.json(factory, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Name already exists" }, { status: 409 });
  }
}
