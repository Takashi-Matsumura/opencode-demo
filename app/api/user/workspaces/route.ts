import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/app/lib/oidc/session";
import {
  addWorkspace,
  findWorkspaceById,
  listWorkspaces,
  removeWorkspace,
  type WorkspaceEntry,
} from "@/app/lib/user-store";
import { classifyPath, resolveReal } from "@/app/lib/workspace-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicEntry(w: WorkspaceEntry) {
  return {
    id: w.id,
    path: w.path,
    label: w.label,
    type: w.type,
    lastOpenedAt: w.lastOpenedAt,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspaces = await listWorkspaces(user.sub);
  return NextResponse.json({ workspaces: workspaces.map(publicEntry) });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    path?: string;
    force?: boolean;
  };
  if (!body.path) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  let real: string;
  try {
    real = resolveReal(body.path);
  } catch {
    return NextResponse.json({ error: "path unresolvable" }, { status: 404 });
  }

  const { type } = classifyPath(user.sub, real);
  if (type === "external" && !body.force) {
    return NextResponse.json(
      {
        error: "external folder requires confirmation",
        requiresConfirmation: true,
        path: real,
      },
      { status: 409 },
    );
  }

  const entry = await addWorkspace(user.sub, real, type);
  return NextResponse.json({ workspace: publicEntry(entry) });
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await findWorkspaceById(user.sub, id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await removeWorkspace(user.sub, id);
  return NextResponse.json({ ok: true });
}
