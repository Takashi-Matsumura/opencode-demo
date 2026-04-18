import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { resolveWithinSession } from "@/app/lib/workspace-guard";
import { getSessionUser } from "@/app/lib/oidc/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 32 * 1024 * 1024; // 32 MiB per file
const UNSAFE_SEGMENTS = new Set(["", ".", ".."]);

function sanitizeRelative(rel: string): string | null {
  const normalized = rel.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized) return null;
  for (const seg of normalized.split("/")) {
    if (UNSAFE_SEGMENTS.has(seg)) return null;
    if (seg.length > 255) return null;
  }
  return normalized;
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const token = form.get("token");
  const targetDir = form.get("targetDir");
  const relativePath = form.get("relativePath");
  const file = form.get("file");

  if (typeof token !== "string" || typeof targetDir !== "string" || typeof relativePath !== "string") {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_FILE_BYTES} bytes)` },
      { status: 413 },
    );
  }

  const rel = sanitizeRelative(relativePath);
  if (!rel) {
    return NextResponse.json({ error: "invalid relative path" }, { status: 400 });
  }

  const gate = await resolveWithinSession(token, targetDir, user.sub);
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: gate.status });
  }

  const finalPath = path.join(gate.path, rel);
  const relToRoot = path.relative(gate.path, finalPath);
  if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) {
    return NextResponse.json({ error: "path escapes workspace" }, { status: 403 });
  }

  await fs.mkdir(path.dirname(finalPath), { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(finalPath, buffer);

  return NextResponse.json({ ok: true, path: finalPath, size: buffer.length });
}
