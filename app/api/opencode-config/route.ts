import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { resolveWithinSession } from "@/app/lib/workspace-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIG_FILE = "opencode.json";

function resolveCwd(token: string, cwd: string) {
  return resolveWithinSession(token, cwd);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const cwd = request.nextUrl.searchParams.get("cwd");
  if (!token || !cwd) {
    return NextResponse.json({ error: "missing token or cwd" }, { status: 400 });
  }

  const check = resolveCwd(token, cwd);
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const filePath = path.join(check.path, CONFIG_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ config: JSON.parse(raw), path: filePath });
  } catch {
    return NextResponse.json({ config: null, path: filePath });
  }
}

export async function PUT(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const cwd = request.nextUrl.searchParams.get("cwd");
  if (!token || !cwd) {
    return NextResponse.json({ error: "missing token or cwd" }, { status: 400 });
  }

  const check = resolveCwd(token, cwd);
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await request.json();
  const filePath = path.join(check.path, CONFIG_FILE);
  await fs.writeFile(filePath, JSON.stringify(body.config, null, 2) + "\n", "utf-8");
  return NextResponse.json({ ok: true });
}
