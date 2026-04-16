import { execFile } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SESSION_FILE = join(tmpdir(), "opencode-pty-sessions.json");

function readSessionFile(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeSessionFile(data: Record<string, number>): void {
  writeFileSync(SESSION_FILE, JSON.stringify(data), "utf-8");
}

export function saveSession(id: string, pid: number): void {
  const data = readSessionFile();
  data[id] = pid;
  writeSessionFile(data);
}

export function removeSession(id: string): void {
  const data = readSessionFile();
  delete data[id];
  if (Object.keys(data).length === 0) {
    try { unlinkSync(SESSION_FILE); } catch {}
  } else {
    writeSessionFile(data);
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getDescendants(rootPid: number): Promise<number[]> {
  return new Promise((resolve) => {
    execFile("ps", ["-ax", "-o", "pid=,ppid="], (err, stdout) => {
      if (err) { resolve([]); return; }

      const children = new Map<number, number[]>();
      for (const line of stdout.trim().split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;
        const pid = Number(parts[0]);
        const ppid = Number(parts[1]);
        if (Number.isNaN(pid) || Number.isNaN(ppid)) continue;
        if (!children.has(ppid)) children.set(ppid, []);
        children.get(ppid)!.push(pid);
      }

      const result: number[] = [];
      const stack = children.get(rootPid) ?? [];
      while (stack.length > 0) {
        const pid = stack.pop()!;
        result.push(pid);
        const grandchildren = children.get(pid);
        if (grandchildren) stack.push(...grandchildren);
      }
      resolve(result);
    });
  });
}

export function findByEnvVar(sessionId: string): Promise<number[]> {
  return new Promise((resolve) => {
    execFile("ps", ["eww", "-ax", "-o", "pid="], (err, stdout) => {
      if (err) { resolve([]); return; }

      const pids: number[] = [];
      const marker = `OPENCODE_SESSION_ID=${sessionId}`;
      const lines = stdout.trim().split("\n");
      for (const line of lines) {
        if (line.includes(marker)) {
          const pid = Number(line.trim().split(/\s+/)[0]);
          if (!Number.isNaN(pid) && pid !== process.pid) pids.push(pid);
        }
      }
      resolve(pids);
    });
  });
}

function killPids(pids: number[], signal: NodeJS.Signals): void {
  for (const pid of pids) {
    try { process.kill(pid, signal); } catch {}
  }
}

export async function killTree(
  rootPid: number,
  gracePeriodMs = 3000,
  sessionId?: string,
): Promise<void> {
  try { process.kill(-rootPid, "SIGTERM"); } catch {}

  const descendants = await getDescendants(rootPid);
  const envPids = sessionId ? await findByEnvVar(sessionId) : [];

  const seen = new Set<number>();
  const allPids: number[] = [];
  for (const pid of [...descendants.reverse(), rootPid, ...envPids]) {
    if (!seen.has(pid)) { seen.add(pid); allPids.push(pid); }
  }

  killPids(allPids, "SIGTERM");

  await new Promise((r) => setTimeout(r, gracePeriodMs));

  killPids(allPids.filter((p) => isAlive(p)), "SIGKILL");
}

export async function reapOrphans(): Promise<void> {
  const data = readSessionFile();
  const ids = Object.keys(data);
  if (ids.length === 0) return;

  console.log(`[process-cleanup] reaping ${ids.length} orphaned session(s)`);
  for (const id of ids) {
    const pid = data[id];
    console.log(`[process-cleanup] killing orphan session=${id} pid=${pid}`);
    await killTree(pid, 2000, id);
  }
  try { unlinkSync(SESSION_FILE); } catch {}
}
