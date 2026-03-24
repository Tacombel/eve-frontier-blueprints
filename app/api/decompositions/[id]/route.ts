import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { requireAdmin } from "@/lib/auth";
import { requireDev } from "@/lib/dev-guard";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const d = await prisma.decomposition.findUnique({
    where: { id: params.id },
    include: { sourceItem: true, outputs: { include: { item: true } } },
  });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(d);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const body = await req.json();
  const { refinery, inputQty, isDefault, outputs } = body;

  const d = await prisma.$transaction(async (tx) => {
    // If setting as default, unset existing default for same sourceItem
    if (isDefault) {
      const current = await tx.decomposition.findUnique({ where: { id: params.id } });
      if (current) {
        await tx.decomposition.updateMany({
          where: { sourceItemId: current.sourceItemId, isDefault: true, id: { not: params.id } },
          data: { isDefault: false },
        });
      }
    }

    if (outputs !== undefined) {
      await tx.decompositionOutput.deleteMany({ where: { decompositionId: params.id } });
    }

    return tx.decomposition.update({
      where: { id: params.id },
      data: {
        ...(refinery !== undefined && { refinery: normalizeName(refinery) }),
        ...(inputQty !== undefined && { inputQty }),
        ...(isDefault !== undefined && { isDefault }),
        ...(outputs !== undefined && {
          outputs: {
            create: outputs.map((o: { itemId: string; quantity: number }) => ({
              itemId: o.itemId,
              quantity: o.quantity,
            })),
          },
        }),
      },
      include: { sourceItem: true, outputs: { include: { item: true } } },
    });
  });

  return NextResponse.json(d);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const deleted = await prisma.decomposition.delete({ where: { id: params.id } });

  // If it was the default, promote another decomposition for the same item
  const remaining = await prisma.decomposition.findFirst({
    where: { sourceItemId: deleted.sourceItemId },
    orderBy: { createdAt: "asc" },
  });
  if (remaining) {
    await prisma.decomposition.update({ where: { id: remaining.id }, data: { isDefault: true } });
  }

  return NextResponse.json({ ok: true });
}
