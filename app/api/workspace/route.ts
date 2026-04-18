import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { resolveWithinSession } from "@/app/lib/workspace-guard";
import { getSessionUser } from "@/app/lib/oidc/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Entry = {
  name: string;
  isDir: boolean;
  size: number;
  mtimeMs: number;
};

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = request.nextUrl.searchParams.get("token");
  const raw = request.nextUrl.searchParams.get("path");
  if (!token || !raw) {
    return NextResponse.json(
      { error: "token and path query required" },
      { status: 400 },
    );
  }

  const gate = await resolveWithinSession(token, raw, user.sub);
  if (!gate.ok) {
    const msg =
      gate.status === 401
        ? "session expired"
        : gate.status === 404
          ? "not found"
          : "outside workspace scope";
    return NextResponse.json({ error: msg }, { status: gate.status });
  }

  const safe = gate.path;
  let stat;
  try {
    stat = await fs.stat(safe);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!stat.isDirectory()) {
    return NextResponse.json({ error: "not a directory" }, { status: 400 });
  }

  try {
    const dirents = await fs.readdir(safe, { withFileTypes: true });
    const entries: Entry[] = await Promise.all(
      dirents.map(async (d) => {
        const full = path.join(safe, d.name);
        let size = 0;
        let mtimeMs = 0;
        try {
          const s = await fs.stat(full);
          size = s.size;
          mtimeMs = s.mtimeMs;
        } catch {}
        return { name: d.name, isDir: d.isDirectory(), size, mtimeMs };
      }),
    );
    entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return NextResponse.json({ path: safe, entries });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "read failed" },
      { status: 500 },
    );
  }
}
