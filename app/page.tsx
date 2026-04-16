"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ZoomIn, ZoomOut, Maximize, Layers, PenTool } from "lucide-react";
import type { View, CanvasActions } from "./demo/components/whiteboard-canvas";
import type { Workspace } from "./demo/components/floating-workspace";
import type { TerminalSession } from "./demo/components/floating-terminal";

const WhiteboardCanvas = dynamic(
  () => import("./demo/components/whiteboard-canvas"),
  { ssr: false },
);
const FloatingTerminal = dynamic(
  () => import("./demo/components/floating-terminal"),
  { ssr: false },
);
const FloatingWorkspace = dynamic(
  () => import("./demo/components/floating-workspace"),
  { ssr: false },
);

export default function Home() {
  const canvasRef = useRef<CanvasActions | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [terminalSession, setTerminalSession] = useState<TerminalSession | null>(
    null,
  );
  const [drawOver, setDrawOver] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);

  const startOpenCode = () => {
    if (!workspace) return;
    setTerminalSession({ cwd: workspace.path, nonce: Date.now() });
  };

  const stopOpenCode = () => setTerminalSession(null);

  return (
    <main className="fixed inset-0 overflow-hidden">
      <WhiteboardCanvas onView={setView} zoomRef={canvasRef} drawOverMode={drawOver} showToolbar={showToolbar} />
      <FloatingWorkspace
        view={view}
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
        onStartOpenCode={startOpenCode}
        onZoomToFit={(rect) => canvasRef.current?.zoomToRect(rect)}
      />
      {terminalSession && (
        <FloatingTerminal
          view={view}
          session={terminalSession}
          onStop={stopOpenCode}
          onZoomToFit={(rect) => canvasRef.current?.zoomToRect(rect)}
          workspaceCwd={workspace?.path}
          workspaceToken={workspace?.token}
        />
      )}
      <footer className="fixed right-0 bottom-0 left-0 z-[60] flex h-8 items-center justify-center gap-1 border-t border-slate-200 bg-white/90 backdrop-blur-sm">
        <button
          type="button"
          onClick={() =>
            canvasRef.current?.setZoom(Math.max(0.1, view.zoom - 0.1), view)
          }
          className="rounded p-1 text-slate-600 hover:bg-slate-100"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => canvasRef.current?.resetZoom()}
          className="min-w-[4rem] rounded px-2 py-0.5 text-center font-mono text-xs text-slate-600 hover:bg-slate-100"
          title="Reset zoom"
        >
          {Math.round(view.zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() =>
            canvasRef.current?.setZoom(Math.min(5, view.zoom + 0.1), view)
          }
          className="rounded p-1 text-slate-600 hover:bg-slate-100"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-slate-300" />
        <button
          type="button"
          onClick={() => canvasRef.current?.resetZoom()}
          className="rounded px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
          title="Reset zoom"
        >
          <Maximize className="inline h-3.5 w-3.5" /> Reset
        </button>
        <span className="mx-1 h-4 w-px bg-slate-300" />
        <button
          type="button"
          onClick={() => setDrawOver((d) => !d)}
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
            drawOver
              ? "bg-sky-500 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          title={drawOver ? "通常モードに戻す" : "パネルの上に描画"}
        >
          <Layers className="h-3.5 w-3.5" />
          {drawOver ? "Draw Over ON" : "Draw Over"}
        </button>
        <span className="mx-1 h-4 w-px bg-slate-300" />
        <button
          type="button"
          onClick={() => setShowToolbar((v) => !v)}
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
            showToolbar
              ? "bg-sky-500 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          title={showToolbar ? "描画ツールを非表示" : "描画ツールを表示"}
        >
          <PenTool className="h-3.5 w-3.5" />
          {showToolbar ? "Toolbar ON" : "Toolbar"}
        </button>
      </footer>
    </main>
  );
}
