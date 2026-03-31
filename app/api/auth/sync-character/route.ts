import { NextResponse } from "next/server";
import { getSession, createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCharacterByWallet } from "@/lib/eve-assets";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.walletAddress) {
    return NextResponse.json({ error: "No wallet linked to this account" }, { status: 400 });
  }

  const character = await getCharacterByWallet(user.walletAddress);
  if (!character?.name?.trim()) {
    return NextResponse.json({ error: "No character found for this wallet" }, { status: 404 });
  }

  const newName = character.name.trim();
  if (newName === user.username) {
    return NextResponse.json({ username: user.username, updated: false });
  }

  // Check name isn't taken by another user
  const taken = await prisma.user.findFirst({
    where: { username: newName, NOT: { id: user.id } },
  });
  if (taken) {
    return NextResponse.json({ error: "Character name already taken by another account" }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { characterName: newName },
  });

  // Re-issue session with updated characterName
  await createSession({ userId: updated.id, username: updated.username, role: updated.role, characterName: updated.characterName ?? undefined });
  return NextResponse.json({ username: updated.username, characterName: updated.characterName, updated: true });
}
