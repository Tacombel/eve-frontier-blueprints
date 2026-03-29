import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

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

  // Find or create user by wallet address
  let user = await prisma.user.findUnique({ where: { walletAddress } });

  const displayName = characterName?.trim() || walletAddress.slice(0, 16);

  if (!user) {
    let username = displayName;
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      username = `${displayName}_${walletAddress.slice(-6)}`;
    }
    user = await prisma.user.create({
      data: { username, walletAddress, role: "USER" },
    });
  } else if (characterName?.trim() && user.username !== characterName.trim()) {
    const newName = characterName.trim();
    const taken = await prisma.user.findFirst({
      where: { username: newName, NOT: { id: user.id } },
    });
    if (!taken) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { username: newName },
      });
    }
  }

  await createSession({ userId: user.id, username: user.username, role: user.role });
  return NextResponse.json({ username: user.username });
}
