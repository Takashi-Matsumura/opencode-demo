import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/app/lib/oidc/session";
import { findWorkspaceById } from "@/app/lib/user-store";
import { canOpenLocally, translateToHostPath } from "@/app/lib/host-path";

const execFileP = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ws = await findWorkspaceById(user.sub, body.id);
  if (!ws) return NextResponse.json({ error: "not found" }, { status: 404 });

  const hostPath = translateToHostPath(ws.path);

  if (canOpenLocally()) {
    try {
      await execFileP("open", [ws.path], { timeout: 5_000 });
      return NextResponse.json({ opened: true, hostPath });
    } catch (err) {
      const message = err instanceof Error ? err.message : "open failed";
      return NextResponse.json({ opened: false, hostPath, error: message });
    }
  }

  return NextResponse.json({ opened: false, hostPath });
}
