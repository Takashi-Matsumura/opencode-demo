import { realpathSync } from "node:fs";
import path from "node:path";
import {
  getUserHomeDirReal,
  listWorkspaces,
  type WorkspaceType,
} from "./user-store";

export class WorkspaceAccessError extends Error {
  constructor(
    message: string,
    public status: 401 | 403 | 404,
  ) {
    super(message);
  }
}

function isUnder(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function resolveReal(absPath: string): string {
  return realpathSync.native(path.resolve(absPath));
}

export function classifyPath(
  sub: string,
  realPath: string,
): { type: WorkspaceType } {
  const home = getUserHomeDirReal(sub);
  return isUnder(realPath, home) ? { type: "internal" } : { type: "external" };
}

export async function assertPathBelongsToUser(
  sub: string,
  realPath: string,
): Promise<void> {
  const home = getUserHomeDirReal(sub);
  if (isUnder(realPath, home)) return;

  const workspaces = await listWorkspaces(sub);
  const allowed = workspaces.some(
    (w) => w.type === "external" && (w.path === realPath || isUnder(realPath, w.path)),
  );
  if (!allowed) {
    throw new WorkspaceAccessError(
      "path is outside the user's workspace scope",
      403,
    );
  }
}
