import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const refinery = await prisma.refinery.update({ where: { id: params.id }, data: { name: normalizeName(name) } });
    return NextResponse.json(refinery);
  } catch {
    return NextResponse.json({ error: "Not found or name already exists" }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.refinery.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
