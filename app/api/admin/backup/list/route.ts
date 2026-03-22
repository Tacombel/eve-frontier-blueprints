import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readdirSync, statSync, existsSync } from "fs";
import { resolve } from "path";

const VALID_FILENAME = /^eve_\d{8}_\d{6}\.db$/;

function resolveBackupDir(): string | null {
  const candidates = ["/data/backups", resolve(process.cwd(), "prisma/backups")];
  return candidates.find(existsSync) ?? null;
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const backupDir = resolveBackupDir();
  if (!backupDir) return NextResponse.json([]);

  try {
    const files = readdirSync(backupDir)
      .filter((f) => VALID_FILENAME.test(f))
      .map((name) => {
        const stat = statSync(resolve(backupDir, name));
        return { name, size: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
    return NextResponse.json(files);
  } catch {
    return NextResponse.json({ error: "Error leyendo el directorio de backups" }, { status: 500 });
  }
}
