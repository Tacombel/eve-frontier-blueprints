import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createReadStream, readFileSync, statSync, writeFileSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";
import { tmpdir } from "os";

function resolveDbPath(): string | null {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (dbUrl.startsWith("file:")) {
    const filePart = dbUrl.slice("file:".length);
    if (filePart.startsWith("/")) return filePart;
    return resolve(process.cwd(), "prisma", filePart);
  }
  const candidates = [
    "/data/eve.db",
    resolve(process.cwd(), "prisma/dev.db"),
  ];
  for (const p of candidates) {
    try { readFileSync(p); return p; } catch { /* skip */ }
  }
  return null;
}

function getTablesFromFile(dbPath: string): string[] {
  const code = `const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(${JSON.stringify(dbPath)});const r=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();process.stdout.write(JSON.stringify(r.map(x=>x.name)));db.close();`;
  const out = execFileSync(process.execPath, ["-e", code], {
    encoding: "utf8",
    timeout: 5000,
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  });
  return JSON.parse(out) as string[];
}

function validateSchema(buffer: Buffer, currentDbPath: string): { ok: boolean; missing?: string[] } {
  const tmpPath = resolve(tmpdir(), `eve_schema_check_${Date.now()}.db`);
  try {
    writeFileSync(tmpPath, buffer);
    const required = getTablesFromFile(currentDbPath);
    const existing = getTablesFromFile(tmpPath);
    const missing = required.filter((t) => !existing.includes(t));
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  } catch {
    return { ok: false };
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

const SQLITE_MAGIC = "SQLite format 3\0";
const MAX_SIZE = 100 * 1024 * 1024;

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const dbPath = resolveDbPath();
  if (!dbPath) return NextResponse.json({ error: "No se encontró la base de datos" }, { status: 500 });

  let dbSize: number;
  try {
    dbSize = statSync(dbPath).size;
  } catch {
    return NextResponse.json({ error: "No se puede acceder a la base de datos" }, { status: 500 });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `eve_backup_${timestamp}.db`;

  const fileStream = createReadStream(dbPath);
  const readable = new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk) => controller.enqueue(chunk));
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(readable, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(dbSize),
    },
  });
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const file = formData.get("backup");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No se proporcionó el archivo" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "El archivo supera el límite de 100 MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const magic = buffer.subarray(0, 16).toString("binary");
  if (magic !== SQLITE_MAGIC) {
    return NextResponse.json({ error: "El archivo no es una base de datos SQLite válida" }, { status: 400 });
  }

  const dbPath = resolveDbPath();
  if (!dbPath) return NextResponse.json({ error: "No se encontró la ruta de la base de datos" }, { status: 500 });

  const schemaCheck = validateSchema(buffer, dbPath);
  if (!schemaCheck.ok) {
    const missing = schemaCheck.missing?.join(", ") ?? "desconocidas";
    return NextResponse.json(
      { error: `El backup no es compatible con esta versión. Tablas faltantes: ${missing}` },
      { status: 400 }
    );
  }

  await prisma.$disconnect();

  try {
    writeFileSync(dbPath, buffer);
  } catch {
    return NextResponse.json({ error: "No se pudo escribir la base de datos" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
