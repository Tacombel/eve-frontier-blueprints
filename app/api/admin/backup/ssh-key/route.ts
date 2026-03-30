import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from "fs";
import { resolve } from "path";
import { execFileSync } from "child_process";
import { name as appName } from "@/package.json";

function resolveSSHDir(): string {
  const dir = existsSync("/data") ? "/data/ssh" : resolve(process.cwd(), "prisma/ssh");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const oldKey = resolve(dir, "eve_backup_rsa");
  const newKey = resolve(dir, `${appName}_backup_ed25519`);
  if (existsSync(oldKey) && !existsSync(newKey)) {
    try {
      renameSync(oldKey, newKey);
      if (existsSync(`${oldKey}.pub`)) renameSync(`${oldKey}.pub`, `${newKey}.pub`);
    } catch { /* no crítico */ }
  }
  return dir;
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const sshDir = resolveSSHDir();
  const pubKeyPath = resolve(sshDir, `${appName}_backup_ed25519.pub`);
  if (!existsSync(pubKeyPath)) return NextResponse.json({ publicKey: null });

  const publicKey = readFileSync(pubKeyPath, "utf8").trim();
  return NextResponse.json({ publicKey });
}

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const sshDir = resolveSSHDir();
  const keyPath = resolve(sshDir, `${appName}_backup_ed25519`);

  try { unlinkSync(keyPath); } catch { /* no existía */ }
  try { unlinkSync(`${keyPath}.pub`); } catch { /* no existía */ }

  try {
    execFileSync("ssh-keygen", ["-t", "ed25519", "-N", "", "-f", keyPath, "-C", `${appName}_backup`], {
      timeout: 10_000,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) {
      return NextResponse.json({ error: "ssh-keygen is not available in this environment" }, { status: 500 });
    }
    return NextResponse.json({ error: `Error generating SSH key: ${msg}` }, { status: 500 });
  }

  const publicKey = readFileSync(`${keyPath}.pub`, "utf8").trim();
  return NextResponse.json({ publicKey });
}
