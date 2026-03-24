import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { requireAdmin } from "@/lib/auth";
import { requireDev } from "@/lib/dev-guard";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const blueprint = await prisma.blueprint.findUnique({
    where: { id: params.id },
    include: {
      outputItem: true,
      inputs: { include: { item: true } },
    },
  });

  if (!blueprint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(blueprint);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const body = await req.json();
  const { factory, outputQty, isDefault, inputs } = body;

  const blueprint = await prisma.$transaction(async (tx) => {
    // If setting as default, unset existing default for same outputItem
    if (isDefault) {
      const current = await tx.blueprint.findUnique({ where: { id: params.id } });
      if (current) {
        await tx.blueprint.updateMany({
          where: { outputItemId: current.outputItemId, isDefault: true, id: { not: params.id } },
          data: { isDefault: false },
        });
      }
    }

    if (inputs !== undefined) {
      await tx.blueprintInput.deleteMany({ where: { blueprintId: params.id } });
    }

    return tx.blueprint.update({
      where: { id: params.id },
      data: {
        ...(factory !== undefined && { factory: normalizeName(factory) }),
        ...(outputQty !== undefined && { outputQty }),
        ...(isDefault !== undefined && { isDefault }),
        ...(inputs !== undefined && {
          inputs: {
            create: inputs.map((i: { itemId: string; quantity: number }) => ({
              itemId: i.itemId,
              quantity: i.quantity,
            })),
          },
        }),
      },
      include: {
        outputItem: true,
        inputs: { include: { item: true } },
      },
    });
  });

  return NextResponse.json(blueprint);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const deleted = await prisma.blueprint.delete({ where: { id: params.id } });

  // If the deleted blueprint was the default, promote the next one
  const remaining = await prisma.blueprint.findFirst({
    where: { outputItemId: deleted.outputItemId },
    orderBy: { createdAt: "asc" },
  });
  if (remaining) {
    await prisma.blueprint.update({ where: { id: remaining.id }, data: { isDefault: true } });
  }

  return NextResponse.json({ ok: true });
}
