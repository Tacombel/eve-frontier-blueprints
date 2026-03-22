import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const packs = await prisma.pack.findMany({
    where: { userId: session.userId },
    include: { items: { include: { item: { select: { id: true, name: true, isRawMaterial: true, isFound: true, blueprints: { where: { isDefault: true }, select: { factory: true }, take: 1 } } } } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(packs);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, items = [] } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const pack = await prisma.pack.create({
    data: {
      name: name.trim(),
      description,
      userId: session.userId,
      items: {
        create: items.map((i: { itemId: string; quantity: number }) => ({
          itemId: i.itemId,
          quantity: i.quantity,
        })),
      },
    },
    include: { items: { include: { item: { select: { id: true, name: true, isRawMaterial: true, isFound: true, blueprints: { where: { isDefault: true }, select: { factory: true }, take: 1 } } } } } },
  });

  return NextResponse.json(pack, { status: 201 });
}
