import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const session = await getSession();

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only SUPERADMIN can reset a SUPERADMIN's password
  if (target.role === "SUPERADMIN" && session!.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Only a superadmin can reset a superadmin's password" }, { status: 403 });
  }

  const { newPassword } = await req.json();

  if (!newPassword) {
    return NextResponse.json({ error: "New password is required" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: params.id }, data: { password: hashed } });

  return NextResponse.json({ ok: true });
}
