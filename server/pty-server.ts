import { WebSocketServer, WebSocket } from "ws";
import * as pty from "@homebridge/node-pty-prebuilt-multiarch";

const PORT = Number(process.env.PTY_PORT ?? 4097);
const SHELL_CMD = process.env.PTY_CMD ?? "opencode";
const CWD = process.env.PTY_CWD ?? process.cwd();

type ClientMessage =
  | { type: "data"; data: string }
  | { type: "resize"; cols: number; rows: number };

const wss = new WebSocketServer({ port: PORT });

console.log(`[pty-server] listening on ws://127.0.0.1:${PORT}`);
console.log(`[pty-server] cmd=${SHELL_CMD} cwd=${CWD}`);

wss.on("connection", (ws: WebSocket) => {
  console.log("[pty-server] client connected");

  const term = pty.spawn(SHELL_CMD, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: CWD,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      LANG: process.env.LANG ?? "en_US.UTF-8",
    } as Record<string, string>,
  });

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
