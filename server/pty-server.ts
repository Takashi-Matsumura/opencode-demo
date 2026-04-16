import { WebSocketServer, WebSocket } from "ws";
import { statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as pty from "@homebridge/node-pty-prebuilt-multiarch";
import type { IPty } from "@homebridge/node-pty-prebuilt-multiarch";
import type { IncomingMessage } from "node:http";
import { killTree, saveSession, removeSession, reapOrphans } from "./process-cleanup.js";

const PORT = Number(process.env.PTY_PORT ?? 4097);
const OC_CMD = process.env.PTY_CMD ?? "opencode";
const DEFAULT_CWD = process.env.PTY_CWD ?? process.cwd();
const USER_SHELL = process.env.SHELL ?? "/bin/zsh";
const HEARTBEAT_MS = 15_000;
const DISCONNECT_TIMEOUT_MS = 5 * 60 * 1000;
const OUTPUT_BUFFER_MAX = 50_000;

type ClientMessage =
  | { type: "data"; data: string }
  | { type: "resize"; cols: number; rows: number };

interface Session {
  term: IPty;
  ws: WebSocket | null;
  pid: number;
  sessionId: string;
  outputBuffer: string[];
  outputBufferLen: number;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  heartbeat: ReturnType<typeof setInterval> | null;
  dead: boolean;
}

const sessions = new Map<string, Session>();

reapOrphans().then(() => {
  console.log("[pty-server] startup orphan reap complete");
});

const wss = new WebSocketServer({ port: PORT });

console.log(`[pty-server] listening on ws://127.0.0.1:${PORT}`);
console.log(`[pty-server] cmd=${OC_CMD} shell=${USER_SHELL} default cwd=${DEFAULT_CWD}`);

function pickCwd(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  const q = url.searchParams.get("cwd");
  if (!q) return DEFAULT_CWD;
  try {
    if (statSync(q).isDirectory()) return q;
  } catch {}
  return DEFAULT_CWD;
}

function pickParam(req: IncomingMessage, key: string): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.searchParams.get(key);
}

function startHeartbeat(s: Session): void {
  stopHeartbeat(s);
  s.heartbeat = setInterval(() => {
    if (s.ws?.readyState === WebSocket.OPEN) s.ws.ping();
  }, HEARTBEAT_MS);
}

function stopHeartbeat(s: Session): void {
  if (s.heartbeat) { clearInterval(s.heartbeat); s.heartbeat = null; }
}

async function destroySession(s: Session): Promise<void> {
  if (s.dead) return;
  s.dead = true;
  stopHeartbeat(s);
  if (s.disconnectTimer) { clearTimeout(s.disconnectTimer); s.disconnectTimer = null; }
  console.log(`[pty-server] destroying session=${s.sessionId} pid=${s.pid}`);

  try { process.kill(-s.pid, "SIGTERM"); } catch {}
  try { s.term.kill(); } catch {}
  await killTree(s.pid, 3000, s.sessionId);

  sessions.delete(s.sessionId);
  removeSession(s.sessionId);
}

function detachWs(s: Session): void {
  stopHeartbeat(s);
  s.ws = null;
  console.log(`[pty-server] session=${s.sessionId} detached, waiting ${DISCONNECT_TIMEOUT_MS / 1000}s for reconnect`);
  s.disconnectTimer = setTimeout(() => {
    console.log(`[pty-server] session=${s.sessionId} reconnect timeout, destroying`);
    destroySession(s);
  }, DISCONNECT_TIMEOUT_MS);
}

function attachWs(s: Session, ws: WebSocket): void {
  if (s.disconnectTimer) { clearTimeout(s.disconnectTimer); s.disconnectTimer = null; }
  s.ws = ws;
  startHeartbeat(s);

  ws.send(JSON.stringify({ type: "session", sessionId: s.sessionId }));

  if (s.outputBuffer.length > 0) {
    for (const chunk of s.outputBuffer) ws.send(chunk);
    s.outputBuffer = [];
    s.outputBufferLen = 0;
  }

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === "data") s.term.write(msg.data);
    else if (msg.type === "resize") s.term.resize(msg.cols, msg.rows);
  });

  ws.on("close", () => {
    if (s.ws !== ws) return;
    console.log(`[pty-server] client disconnected session=${s.sessionId}`);
    detachWs(s);
  });
}

function createSession(ws: WebSocket, cwd: string, cmdOverride: string | null): void {
  const sessionId = randomUUID();
  const activeCmd = cmdOverride ?? OC_CMD;
  console.log(`[pty-server] new session=${sessionId} cwd=${cwd} cmd=${activeCmd}`);

  const escapedCwd = cwd.replace(/'/g, "'\\''");
  const isShellMode = cmdOverride === "shell";
  const args = isShellMode
    ? ["-l"]
    : ["-l", "-c", `cd '${escapedCwd}' && exec ${activeCmd}`];
  const term = pty.spawn(USER_SHELL, args, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      LANG: process.env.LANG ?? "en_US.UTF-8",
      OPENCODE_SESSION_ID: sessionId,
    } as Record<string, string>,
  });

  const s: Session = {
    term,
    ws: null,
    pid: term.pid,
    sessionId,
    outputBuffer: [],
    outputBufferLen: 0,
    disconnectTimer: null,
    heartbeat: null,
    dead: false,
  };
  sessions.set(sessionId, s);
  saveSession(sessionId, term.pid);

  term.onData((data) => {
    if (s.ws?.readyState === WebSocket.OPEN) {
      s.ws.send(data);
    } else if (!s.dead) {
      s.outputBuffer.push(data);
      s.outputBufferLen += data.length;
      while (s.outputBufferLen > OUTPUT_BUFFER_MAX && s.outputBuffer.length > 1) {
        s.outputBufferLen -= s.outputBuffer.shift()!.length;
      }
    }
  });

  term.onExit(({ exitCode, signal }) => {
    console.log(`[pty-server] pty exited session=${sessionId} code=${exitCode} signal=${signal}`);
    if (s.ws?.readyState === WebSocket.OPEN) s.ws.close();
    destroySession(s);
  });

  attachWs(s, ws);
}

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const existingId = pickParam(req, "sessionId");

  if (existingId) {
    const s = sessions.get(existingId);
    if (s && !s.dead) {
      console.log(`[pty-server] reconnecting session=${existingId}`);
      if (s.ws?.readyState === WebSocket.OPEN) s.ws.close();
      attachWs(s, ws);
      return;
    }
    console.log(`[pty-server] session=${existingId} not found, creating new`);
  }

  const cwd = pickCwd(req);
  const cmdOverride = pickParam(req, "cmd");
  createSession(ws, cwd, cmdOverride);
});

async function shutdownAll(signal: string) {
  console.log(`[pty-server] received ${signal}, shutting down all sessions`);
  const cleanups = Array.from(sessions.values()).map((s) => destroySession(s));
  await Promise.allSettled(cleanups);
  wss.close();
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(sig, () => { shutdownAll(sig); });
}
