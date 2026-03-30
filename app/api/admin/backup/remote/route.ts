import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { name as appName } from "@/package.json";

function resolveRemoteConfigPath(): string {
  const base = existsSync("/data") ? "/data" : resolve(process.cwd(), "prisma");
  return resolve(base, "backup_remote.json");
}

interface RemoteConfig {
  host: string | null;
  port: number | null;
  path: string;
  lastSync: string | null;
}

function readConfig(): RemoteConfig {
  const configPath = resolveRemoteConfigPath();
  if (!existsSync(configPath)) return { host: null, port: null, path: `~/sync/${appName}`, lastSync: null };
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as RemoteConfig;
  } catch {
    return { host: null, port: null, path: `~/sync/${appName}`, lastSync: null };
  }
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;
  return NextResponse.json(readConfig());
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.host !== "string") {
    return NextResponse.json({ error: "host is required" }, { status: 400 });
  }

  const host = body.host.trim();
  if (!/^[^@\s]+@[^@\s]+$/.test(host)) {
    return NextResponse.json({ error: "Invalid format. Use user@server" }, { status: 400 });
  }

  const rawPath = typeof body.path === "string" ? body.path.trim() : "";
  const remotePath = rawPath || `~/sync/${appName}`;
  if (remotePath.includes("..") || !/^[\w.~\-/]+$/.test(remotePath)) {
    return NextResponse.json({ error: "Invalid remote path" }, { status: 400 });
  }

  let port: number | null = null;
  if (body.port !== undefined && body.port !== null && body.port !== "") {
    const p = Number(body.port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      return NextResponse.json({ error: "Invalid port (1-65535)" }, { status: 400 });
    }
    port = p;
  }

  const existing = readConfig();
  writeFileSync(resolveRemoteConfigPath(), JSON.stringify({ host, port, path: remotePath, lastSync: existing.lastSync }, null, 2), "utf8");
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const existing = readConfig();
  writeFileSync(resolveRemoteConfigPath(), JSON.stringify({ host: null, port: null, path: existing.path, lastSync: null }, null, 2), "utf8");
  return NextResponse.json({ ok: true });
}
