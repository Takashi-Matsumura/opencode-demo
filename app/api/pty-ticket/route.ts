import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/app/lib/oidc/session";
import { findWorkspaceById } from "@/app/lib/user-store";
import { resolveReal } from "@/app/lib/workspace-access";
import { issuePtyTicket } from "@/app/lib/pty-ticket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    workspaceId?: string;
    sid?: string;
  };
  if (!body.workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const ws = await findWorkspaceById(user.sub, body.workspaceId);
  if (!ws) return NextResponse.json({ error: "not found" }, { status: 404 });

  let cwd: string;
  try {
    cwd = resolveReal(ws.path);
  } catch {
    return NextResponse.json({ error: "workspace path missing" }, { status: 410 });
  }

  const ticket = await issuePtyTicket({ sub: user.sub, cwd, sid: body.sid });
  return NextResponse.json({ ticket });
}
