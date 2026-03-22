import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";

export async function GET() {
  const refineries = await prisma.refinery.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(refineries);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const refinery = await prisma.refinery.create({ data: { name: normalizeName(name) } });
    return NextResponse.json(refinery, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Name already exists" }, { status: 409 });
  }
}
