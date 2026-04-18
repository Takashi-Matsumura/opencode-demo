import { realpathSync } from "node:fs";
import path from "node:path";
import { getSession } from "./workspace-session";
import { assertPathBelongsToUser, WorkspaceAccessError } from "./workspace-access";

function isUnder(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export async function resolveWithinSession(
  token: string,
  requested: string,
  expectedSub: string,
): Promise<{ ok: true; path: string } | { ok: false; status: 401 | 403 | 404 }> {
  const session = getSession(token);
  if (!session) return { ok: false, status: 401 };
  if (session.sub !== expectedSub) return { ok: false, status: 403 };
  if (!requested || typeof requested !== "string") {
    return { ok: false, status: 403 };
  }

  const abs = path.resolve(requested);
  let real: string;
  try {
    real = realpathSync.native(abs);
  } catch {
    return { ok: false, status: 404 };
  }
  if (!isUnder(real, session.rootRealPath)) return { ok: false, status: 403 };

  try {
    await assertPathBelongsToUser(expectedSub, real);
  } catch (err) {
    if (err instanceof WorkspaceAccessError) return { ok: false, status: err.status };
    return { ok: false, status: 403 };
  }

  return { ok: true, path: real };
}
