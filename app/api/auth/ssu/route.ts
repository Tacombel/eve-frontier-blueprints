import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ssuAddress } = await req.json();
  const address = typeof ssuAddress === "string" ? ssuAddress.trim() || null : null;

  await prisma.user.update({ where: { id: session.userId }, data: { ssuAddress: address } });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { ssuAddress: true },
  });

  return NextResponse.json({ ssuAddress: user?.ssuAddress ?? null });
}
