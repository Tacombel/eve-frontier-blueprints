import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { requireAdmin } from "@/lib/auth";
import { requireDev } from "@/lib/dev-guard";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const factory = await prisma.factory.update({ where: { id: params.id }, data: { name: normalizeName(name) } });
    return NextResponse.json(factory);
  } catch {
    return NextResponse.json({ error: "Not found or name already exists" }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  await prisma.factory.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
