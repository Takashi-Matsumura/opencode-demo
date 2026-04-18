import { promises as fs } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { resolveWithinSession } from "@/app/lib/workspace-guard";
import { getSessionUser } from "@/app/lib/oidc/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 512 * 1024;
const SNIFF_BYTES = 8 * 1024;

function looksBinary(buf: Buffer): boolean {
  if (buf.includes(0)) return true;
  const isUtf8 = (Buffer as unknown as { isUtf8?: (b: Buffer) => boolean })
    .isUtf8;
  if (typeof isUtf8 === "function" && !isUtf8(buf)) return true;
  return false;
}

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
  if (!stat.isFile()) {
    return NextResponse.json({ error: "not a file" }, { status: 400 });
  }

  const truncated = stat.size > MAX_BYTES;
  const readLen = Math.min(stat.size, MAX_BYTES);

  const fh = await fs.open(safe, "r");
  try {
    const sniffLen = Math.min(stat.size, SNIFF_BYTES);
    const sniff = Buffer.alloc(sniffLen);
    if (sniffLen > 0) {
      await fh.read(sniff, 0, sniffLen, 0);
      if (looksBinary(sniff)) {
        return NextResponse.json(
          { error: "binary file not supported" },
          { status: 415 },
        );
      }
    }
    const body = Buffer.alloc(readLen);
    if (readLen > 0) {
      await fh.read(body, 0, readLen, 0);
    }
    return NextResponse.json({
      path: safe,
      size: stat.size,
      truncated,
      content: body.toString("utf8"),
    });
  } finally {
    await fh.close();
  }
}
