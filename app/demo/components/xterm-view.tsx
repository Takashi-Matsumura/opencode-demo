"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { PTY_WS_URL, type ClientMessage } from "../lib/ws-protocol";

export default function XtermView({ cwd }: { cwd?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      fontFamily:
        '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
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

    const base = PTY_WS_URL.replace(/\/+$/, "");
    const url = cwd ? `${base}/?cwd=${encodeURIComponent(cwd)}` : base;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    const send = (msg: ClientMessage) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };

    ws.onopen = () => {
      send({ type: "resize", cols: term.cols, rows: term.rows });
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        term.write(ev.data);
      } else {
        term.write(new Uint8Array(ev.data as ArrayBuffer));
      }
    };
    ws.onclose = () => {
      term.write("\r\n\x1b[31m[connection closed]\x1b[0m\r\n");
    };
    ws.onerror = () => {
      term.write(
        "\r\n\x1b[31m[failed to connect to pty server at " +
          PTY_WS_URL +
          "]\x1b[0m\r\n",
      );
    };

    const dataSub = term.onData((data) => send({ type: "data", data }));

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        send({ type: "resize", cols: term.cols, rows: term.rows });
      } catch {}
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      dataSub.dispose();
      ws.close();
      term.dispose();
    };
  }, [cwd]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-[#0b0b0f] p-2"
      style={{ overflow: "hidden" }}
    />
  );
}
