import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const factories = await prisma.factory.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(factories);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const factory = await prisma.factory.create({ data: { name: name.trim() } });
    return NextResponse.json(factory, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Name already exists" }, { status: 409 });
  }
}
