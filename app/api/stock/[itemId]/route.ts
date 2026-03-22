import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: { itemId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quantity } = await req.json();

  if (typeof quantity !== "number" || quantity < 0) {
    return NextResponse.json({ error: "quantity must be a non-negative number" }, { status: 400 });
  }

  const stock = await prisma.stock.upsert({
    where: { itemId_userId: { itemId: params.itemId, userId: session.userId } },
    update: { quantity },
    create: { itemId: params.itemId, userId: session.userId, quantity },
  });

  return NextResponse.json(stock);
}
