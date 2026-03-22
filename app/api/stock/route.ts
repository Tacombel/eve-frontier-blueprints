import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.item.findMany({
    include: { stocks: { where: { userId: session.userId } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    items.map((item) => ({
      id: item.id,
      name: item.name,
      isRawMaterial: item.isRawMaterial,
      isFound: item.isFound,
      isFinalProduct: item.isFinalProduct,
      quantity: item.stocks[0]?.quantity ?? 0,
    }))
  );
}
