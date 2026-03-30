import { NextResponse } from "next/server";
import { SignJWT } from "jose";

export const dynamic = "force-dynamic";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function GET() {
  // Generate a nonce as a short-lived JWT (5 min) so the server can verify it hasn't expired
  const nonce = crypto.randomUUID();
  const token = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSecret());

  return NextResponse.json({ nonce: token });
}
