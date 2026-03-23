import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const session = await getSession();
  const { role: newRole } = await req.json();

  if (!["USER", "ADMIN", "SUPERADMIN"].includes(newRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only SUPERADMIN can touch a SUPERADMIN
  if (target.role === "SUPERADMIN" && session!.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Only a superadmin can modify a superadmin" }, { status: 403 });
  }

  // Only SUPERADMIN can assign SUPERADMIN role
  if (newRole === "SUPERADMIN" && session!.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Only a superadmin can assign the superadmin role" }, { status: 403 });
  }

  // SUPERADMIN cannot demote themselves unless another SUPERADMIN exists
  if (params.id === session!.userId && session!.role === "SUPERADMIN" && newRole !== "SUPERADMIN") {
    const superAdminCount = await prisma.user.count({ where: { role: "SUPERADMIN" } });
    if (superAdminCount <= 1) {
      return NextResponse.json({ error: "Cannot demote yourself: you are the only superadmin" }, { status: 403 });
    }
  }

  // ADMIN cannot demote themselves
  if (params.id === session!.userId && session!.role === "ADMIN" && newRole === "USER") {
    return NextResponse.json({ error: "You cannot demote yourself" }, { status: 403 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { role: newRole },
    select: { id: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const session = await getSession();

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only SUPERADMIN can delete a SUPERADMIN
  if (target.role === "SUPERADMIN" && session!.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Only a superadmin can delete a superadmin" }, { status: 403 });
  }

  if (params.id === session!.userId) {
    if (session!.role === "SUPERADMIN") {
      // SUPERADMIN can delete themselves only if another SUPERADMIN exists
      const superAdminCount = await prisma.user.count({ where: { role: "SUPERADMIN" } });
      if (superAdminCount <= 1) {
        return NextResponse.json({ error: "Cannot delete yourself: you are the only superadmin" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 403 });
    }
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
