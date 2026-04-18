import { promises as fs, mkdirSync, realpathSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

export type WorkspaceType = "internal" | "external";

export type WorkspaceEntry = {
  id: string;
  path: string;
  label: string;
  type: WorkspaceType;
  lastOpenedAt: number;
};

export type UserProfile = {
  sub: string;
  workspaces: WorkspaceEntry[];
};

const APP_DATA_DIR = path.join(os.homedir(), ".opencode-demo");
const USERS_DIR = path.join(APP_DATA_DIR, "users");
const WORKSPACES_BASE = path.join(os.homedir(), "opencode-demo-workspaces");

function sanitizeSub(sub: string): string {
  return sub.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getUserHomeDir(sub: string): string {
  return path.join(WORKSPACES_BASE, sanitizeSub(sub));
}

export function getUserHomeDirReal(sub: string): string {
  const dir = getUserHomeDir(sub);
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch {}
  return realpathSync.native(dir);
}

function userFilePath(sub: string): string {
  return path.join(USERS_DIR, `${sanitizeSub(sub)}.json`);
}

async function ensureDirs(sub: string): Promise<void> {
  await fs.mkdir(USERS_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(getUserHomeDir(sub), { recursive: true, mode: 0o700 });
}

async function readProfile(sub: string): Promise<UserProfile | null> {
  try {
    const raw = await fs.readFile(userFilePath(sub), "utf-8");
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

async function writeProfileAtomic(profile: UserProfile): Promise<void> {
  const finalPath = userFilePath(profile.sub);
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(profile, null, 2) + "\n", {
    encoding: "utf-8",
    mode: 0o600,
  });
  await fs.rename(tmp, finalPath);
}

export async function getUserProfile(sub: string): Promise<UserProfile> {
  await ensureDirs(sub);
  const existing = await readProfile(sub);
  if (existing) {
    const homeDir = getUserHomeDirReal(sub);
    let changed = false;
    for (const w of existing.workspaces) {
      const expected = labelFor(w.path, homeDir);
      if (w.label !== expected) {
        w.label = expected;
        changed = true;
      }
    }
    if (changed) await writeProfileAtomic(existing);
    return existing;
  }
  const fresh: UserProfile = { sub, workspaces: [] };
  await writeProfileAtomic(fresh);
  return fresh;
}

async function mutate(
  sub: string,
  fn: (p: UserProfile) => UserProfile,
): Promise<UserProfile> {
  const current = await getUserProfile(sub);
  const next = fn(current);
  await writeProfileAtomic(next);
  return next;
}

function labelFor(absPath: string, homeDir: string): string {
  if (absPath === homeDir) return "ホーム";
  const rel = path.relative(homeDir, absPath);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    return rel;
  }
  return path.basename(absPath);
}

export async function addWorkspace(
  sub: string,
  absRealPath: string,
  type: WorkspaceType,
): Promise<WorkspaceEntry> {
  const homeDir = getUserHomeDirReal(sub);
  let added!: WorkspaceEntry;
  await mutate(sub, (p) => {
    const existing = p.workspaces.find((w) => w.path === absRealPath);
    if (existing) {
      existing.lastOpenedAt = Date.now();
      added = existing;
      return p;
    }
    added = {
      id: `ws_${randomUUID().slice(0, 12)}`,
      path: absRealPath,
      label: labelFor(absRealPath, homeDir),
      type,
      lastOpenedAt: Date.now(),
    };
    return { ...p, workspaces: [...p.workspaces, added] };
  });
  return added;
}

export async function removeWorkspace(
  sub: string,
  workspaceId: string,
): Promise<boolean> {
  let removed = false;
  await mutate(sub, (p) => {
    const next = p.workspaces.filter((w) => w.id !== workspaceId);
    removed = next.length !== p.workspaces.length;
    return { ...p, workspaces: next };
  });
  return removed;
}

export async function touchWorkspace(
  sub: string,
  workspaceId: string,
): Promise<WorkspaceEntry | null> {
  let touched: WorkspaceEntry | null = null;
  await mutate(sub, (p) => {
    const found = p.workspaces.find((w) => w.id === workspaceId);
    if (found) {
      found.lastOpenedAt = Date.now();
      touched = found;
    }
    return p;
  });
  return touched;
}

export async function findWorkspaceById(
  sub: string,
  workspaceId: string,
): Promise<WorkspaceEntry | null> {
  const profile = await getUserProfile(sub);
  return profile.workspaces.find((w) => w.id === workspaceId) ?? null;
}

export async function listWorkspaces(sub: string): Promise<WorkspaceEntry[]> {
  const profile = await getUserProfile(sub);
  return [...profile.workspaces].sort(
    (a, b) => b.lastOpenedAt - a.lastOpenedAt,
  );
}
