import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { spawn } from "child_process";
import { name as appName } from "@/package.json";

function resolveSSHDir(): string {
  const dir = existsSync("/data") ? "/data/ssh" : resolve(process.cwd(), "prisma/ssh");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function resolveRemoteConfigPath(): string {
  const base = existsSync("/data") ? "/data" : resolve(process.cwd(), "prisma");
  return resolve(base, "backup_remote.json");
}

function resolveBackupDir(): string {
  const dir = existsSync("/data") ? "/data/backups" : resolve(process.cwd(), "prisma/backups");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      resolve(dir, "test_de_backup.txt"),
      `Test file created on ${new Date().toISOString()}.\nThe first real backup will be generated automatically at 02:00.\n`,
      "utf8"
    );
  }
  return dir;
}

interface RemoteConfig {
  host: string | null;
  port: number | null;
  path: string;
  lastSync: string | null;
}

function runRsync(args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const child = spawn("rsync", args);
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    const timer = setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr: stderr + "\nTimed out", code: null });
    }, timeoutMs);
    child.on("close", (code) => { clearTimeout(timer); resolve({ stdout, stderr, code }); });
    child.on("error", (err) => { clearTimeout(timer); resolve({ stdout, stderr: err.message, code: null }); });
  });
}

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const configPath = resolveRemoteConfigPath();
  if (!existsSync(configPath)) {
    return NextResponse.json({ ok: false, error: "No remote configuration found. Set up the target server first." }, { status: 400 });
  }

  let config: RemoteConfig;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8")) as RemoteConfig;
  } catch {
    return NextResponse.json({ ok: false, error: "Error reading remote configuration." }, { status: 500 });
  }

  if (!config.host) {
    return NextResponse.json({ ok: false, error: "No remote server configured." }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(config.host)) {
    return NextResponse.json({ ok: false, error: "Invalid host configuration." }, { status: 400 });
  }

  const sshDir = resolveSSHDir();
  const keyPath = resolve(sshDir, `${appName}_backup_ed25519`);
  if (!existsSync(keyPath)) {
    return NextResponse.json({ ok: false, error: "No SSH key generated. Generate a key first." }, { status: 400 });
  }

  const backupDir = resolveBackupDir();

  const knownHostsPath = resolve(sshDir, "known_hosts");
  const remotePath = config.path || `~/sync/${appName}`;
  const portNum = config.port ? parseInt(String(config.port), 10) : NaN;
  const portFlag = !isNaN(portNum) && portNum > 0 && portNum <= 65535 ? ` -p ${portNum}` : "";

  const sshCmd = `ssh -i "${keyPath}"${portFlag} -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="${knownHostsPath}" -o BatchMode=yes`;

  const result = await runRsync(
    ["-avz", "--mkpath", "-e", sshCmd, backupDir + "/", `${config.host}:${remotePath}/`],
    60_000
  );

  if (result.stderr.includes("ENOENT") || result.stderr.includes("not found")) {
    return NextResponse.json({ ok: false, error: "rsync is not available in this environment." }, { status: 500 });
  }

  if (result.code !== 0) {
    return NextResponse.json(
      { ok: false, error: result.stderr || result.stdout || `rsync exited with code ${result.code}` },
      { status: 500 }
    );
  }

  config.lastSync = new Date().toISOString();
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

  return NextResponse.json({ ok: true, output: result.stdout });
}
