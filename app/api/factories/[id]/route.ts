import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const factory = await prisma.factory.update({ where: { id: params.id }, data: { name: name.trim() } });
    return NextResponse.json(factory);
  } catch {
    return NextResponse.json({ error: "Not found or name already exists" }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.factory.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
