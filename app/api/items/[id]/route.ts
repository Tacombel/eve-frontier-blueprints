import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { requireAdmin } from "@/lib/auth";
import { requireDev } from "@/lib/dev-guard";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const item = await prisma.item.findUnique({
    where: { id: params.id },
    include: {
      stocks: true,
      blueprints: { include: { inputs: { include: { item: true } } } },
    },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const body = await req.json();
  const { name, isRawMaterial, isFound, isFinalProduct, volume } = body;

  const item = await prisma.item.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name: normalizeName(name) }),
      ...(isRawMaterial !== undefined && { isRawMaterial }),
      ...(isFound !== undefined && { isFound }),
      ...(isFinalProduct !== undefined && { isFinalProduct }),
      ...(volume !== undefined && { volume }),
    },
    include: { stocks: true, blueprints: { select: { id: true, factory: true, outputQty: true, isDefault: true } } },
  });

  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  await prisma.item.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
