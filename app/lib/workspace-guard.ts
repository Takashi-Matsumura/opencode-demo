import { realpathSync } from "node:fs";
import path from "node:path";
import { getSessionRoot } from "./workspace-session";

function isUnder(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function resolveWithinSession(
  token: string,
  requested: string,
): { ok: true; path: string } | { ok: false; status: 401 | 403 | 404 } {
  const root = getSessionRoot(token);
  if (!root) return { ok: false, status: 401 };
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
  if (!isUnder(real, root)) return { ok: false, status: 403 };
  return { ok: true, path: real };
}
