import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { getCharacterByWallet } from "@/lib/eve-assets";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function POST(req: NextRequest) {
  const { walletAddress, characterName, nonce } = await req.json();

  if (!walletAddress || !nonce) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the nonce is valid and hasn't expired (5 min TTL, signed by us)
  try {
    await jwtVerify(nonce, getSecret());
  } catch {
    return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 401 });
  }

  // Resolve character name: server-side GraphQL (authoritative) > client hint > address fallback
  const character = await getCharacterByWallet(walletAddress);
  const resolvedName = character?.name?.trim() || characterName?.trim() || null;

  // Find or create user by wallet address
  let user = await prisma.user.findUnique({ where: { walletAddress } });

  const displayName = resolvedName || walletAddress.slice(0, 16);

  if (!user) {
    let username = displayName;
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      username = `${displayName}_${walletAddress.slice(-6)}`;
    }
    user = await prisma.user.create({
      data: { username, walletAddress, role: "USER", characterName: resolvedName ?? null },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { characterName: resolvedName ?? user.characterName ?? null },
    });
  }

  await createSession({ userId: user.id, username: user.username, role: user.role, characterName: user.characterName ?? undefined });
  return NextResponse.json({ username: user.username, characterName: user.characterName ?? null });
}
