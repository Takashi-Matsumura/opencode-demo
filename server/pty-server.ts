import { WebSocketServer, WebSocket } from "ws";
import { statSync } from "node:fs";
import * as pty from "@homebridge/node-pty-prebuilt-multiarch";
import type { IncomingMessage } from "node:http";

const PORT = Number(process.env.PTY_PORT ?? 4097);
const OC_CMD = process.env.PTY_CMD ?? "opencode";
const DEFAULT_CWD = process.env.PTY_CWD ?? process.cwd();
const USER_SHELL = process.env.SHELL ?? "/bin/zsh";

type ClientMessage =
  | { type: "data"; data: string }
  | { type: "resize"; cols: number; rows: number };

const wss = new WebSocketServer({ port: PORT });

console.log(`[pty-server] listening on ws://127.0.0.1:${PORT}`);
console.log(`[pty-server] cmd=${OC_CMD} shell=${USER_SHELL} default cwd=${DEFAULT_CWD}`);

function pickCwd(req: IncomingMessage): string {
  console.log(`[pty-server] req.url=${req.url}`);
  const url = new URL(req.url ?? "/", "http://localhost");
  const q = url.searchParams.get("cwd");
  if (!q) {
    console.log(`[pty-server] no cwd param, using default=${DEFAULT_CWD}`);
    return DEFAULT_CWD;
  }
  try {
    if (statSync(q).isDirectory()) {
      console.log(`[pty-server] cwd resolved to ${q}`);
      return q;
    }
  } catch {}
  console.log(`[pty-server] cwd=${q} invalid, falling back to ${DEFAULT_CWD}`);
  return DEFAULT_CWD;
}

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const cwd = pickCwd(req);
  console.log(`[pty-server] client connected cwd=${cwd}`);

  const escapedCwd = cwd.replace(/'/g, "'\\''");
  const term = pty.spawn(
    USER_SHELL,
    ["-l", "-c", `cd '${escapedCwd}' && exec ${OC_CMD}`],
    {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        LANG: process.env.LANG ?? "en_US.UTF-8",
      } as Record<string, string>,
    },
  );

  term.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });

  term.onExit(({ exitCode, signal }) => {
    console.log(`[pty-server] pty exited code=${exitCode} signal=${signal}`);
    if (ws.readyState === ws.OPEN) ws.close();
  });

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === "data") term.write(msg.data);
    else if (msg.type === "resize") term.resize(msg.cols, msg.rows);
  });

  ws.on("close", () => {
    console.log("[pty-server] client disconnected, killing pty");
    try {
      term.kill();
    } catch {}
  });
});

process.on("SIGINT", () => {
  console.log("[pty-server] shutting down");
  wss.close();
  process.exit(0);
});
