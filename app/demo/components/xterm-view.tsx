"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { PTY_WS_URL, type ClientMessage, type ServerMessage } from "../lib/ws-protocol";

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 2000;

export default function XtermView({ cwd, cmd, fontSize = 13 }: { cwd?: string | null; cmd?: string | null; fontSize?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      fontFamily:
        '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize,
      cursorBlink: true,
      theme: {
        background: "#0b0b0f",
        foreground: "#e6e6ea",
        cursor: "#e6e6ea",
      },
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();

    const textarea = el.querySelector("textarea");
    textarea?.blur();

    let sessionId: string | null = null;
    let ws: WebSocket | null = null;
    let retries = 0;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const send = (msg: ClientMessage) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };

    const dataSub = term.onData((data) => send({ type: "data", data }));

    function buildUrl(): string {
      const base = PTY_WS_URL.replace(/\/+$/, "");
      const params = new URLSearchParams();
      if (sessionId) {
        params.set("sessionId", sessionId);
      } else {
        if (cwd) params.set("cwd", cwd);
        if (cmd) params.set("cmd", cmd);
      }
      const qs = params.toString();
      return qs ? `${base}/?${qs}` : base;
    }

    function connect() {
      if (disposed) return;
      ws = new WebSocket(buildUrl());
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        retries = 0;
        send({ type: "resize", cols: term.cols, rows: term.rows });
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          try {
            const msg: ServerMessage = JSON.parse(ev.data);
            if (msg.type === "session") {
              sessionId = msg.sessionId;
              return;
            }
          } catch {}
          term.write(ev.data);
        } else {
          term.write(new Uint8Array(ev.data as ArrayBuffer));
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        if (retries < MAX_RETRIES) {
          retries++;
          term.write(`\r\n\x1b[33m[reconnecting ${retries}/${MAX_RETRIES}...]\x1b[0m\r\n`);
          retryTimer = setTimeout(connect, RETRY_INTERVAL_MS);
        } else {
          term.write("\r\n\x1b[31m[connection lost]\x1b[0m\r\n");
        }
      };

      ws.onerror = () => {};
    }

    connect();

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        send({ type: "resize", cols: term.cols, rows: term.rows });
      } catch {}
    });
    ro.observe(el);

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ro.disconnect();
      dataSub.dispose();
      ws?.close();
      term.dispose();
    };
  }, [cwd, cmd, fontSize]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-[#0b0b0f] p-2"
      style={{ overflow: "hidden" }}
    />
  );
}
