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
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const location = await prisma.location.update({
    where: { id: params.id },
    data: { name: normalizeName(name) },
  });
  return NextResponse.json(location);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  await prisma.location.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
