import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { requireAdmin } from "@/lib/auth";
import { requireDev } from "@/lib/dev-guard";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const isRawMaterial = searchParams.get("isRawMaterial");
  const isFinalProduct = searchParams.get("isFinalProduct");

  const items = await prisma.item.findMany({
    where: {
      name: search ? { contains: search } : undefined,
      isRawMaterial: isRawMaterial !== null ? isRawMaterial === "true" : undefined,
      isFinalProduct: isFinalProduct !== null ? isFinalProduct === "true" : undefined,
    },
    include: { stocks: true, blueprints: { select: { id: true, factory: true, outputQty: true, isDefault: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const body = await req.json();
  const { name, isRawMaterial = false, isFound = false, isFinalProduct = false, volume = 0 } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const item = await prisma.item.create({
    data: { name: normalizeName(name), isRawMaterial, isFound, isFinalProduct, volume },
    include: { stocks: true, blueprints: { select: { id: true, factory: true, outputQty: true, isDefault: true } } },
  });

  return NextResponse.json(item, { status: 201 });
}
