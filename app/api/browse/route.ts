import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/app/lib/oidc/session";
import { getUserHomeDirReal } from "@/app/lib/user-store";
import { resolveReal } from "@/app/lib/workspace-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUnder(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const homeDir = getUserHomeDirReal(user.sub);
  const rawPath = request.nextUrl.searchParams.get("path") ?? homeDir;

  let target: string;
  try {
    target = resolveReal(rawPath);
  } catch {
    return NextResponse.json({ error: "path unresolvable" }, { status: 404 });
  }

  if (!isUnder(target, homeDir)) {
    return NextResponse.json(
      { error: "path outside user home" },
      { status: 403 },
    );
  }

  let dirents;
  try {
    dirents = await fs.readdir(target, { withFileTypes: true });
  } catch {
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }

  const entries = dirents
    .filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, path: path.join(target, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const parent = target === homeDir ? null : path.dirname(target);

  return NextResponse.json({
    home: homeDir,
    path: target,
    parent,
    entries,
  });
}
