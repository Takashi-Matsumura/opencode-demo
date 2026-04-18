import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/app/lib/oidc/session";
import { findWorkspaceById, touchWorkspace } from "@/app/lib/user-store";
import { registerSession } from "@/app/lib/workspace-session";
import { resolveReal } from "@/app/lib/workspace-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ws = await findWorkspaceById(user.sub, body.id);
  if (!ws) return NextResponse.json({ error: "not found" }, { status: 404 });

  let real: string;
  try {
    real = resolveReal(ws.path);
  } catch {
    return NextResponse.json(
      { error: "workspace path no longer exists" },
      { status: 410 },
    );
  }

  const token = registerSession(user.sub, real, ws.id);
  await touchWorkspace(user.sub, ws.id);

  return NextResponse.json({
    token,
    workspace: {
      id: ws.id,
      path: real,
      label: ws.label,
      type: ws.type,
    },
  });
}
