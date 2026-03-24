import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import { requireAdmin } from "@/lib/auth";
import { requireDev } from "@/lib/dev-guard";

export async function GET() {
  const asteroids = await prisma.asteroidType.findMany({
    orderBy: { name: "asc" },
    include: {
      locations: { include: { location: true } },
      items: { include: { item: true } },
    },
  });
  return NextResponse.json(asteroids);
}

export async function POST(req: NextRequest) {
  const devError = requireDev();
  if (devError) return devError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const { name, locationIds = [], itemIds = [] } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const asteroid = await prisma.asteroidType.create({
    data: {
      name: normalizeName(name),
      locations: {
        create: (locationIds as string[]).map((locationId) => ({ locationId })),
      },
      items: {
        create: (itemIds as string[]).map((itemId) => ({ itemId })),
      },
    },
    include: {
      locations: { include: { location: true } },
      items: { include: { item: true } },
    },
  });
  return NextResponse.json(asteroid, { status: 201 });
}
