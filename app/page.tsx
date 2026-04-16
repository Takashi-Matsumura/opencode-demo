"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { View, ZoomToRectFn } from "./demo/components/whiteboard-canvas";
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
  const zoomRef = useRef<ZoomToRectFn | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [terminalSession, setTerminalSession] = useState<TerminalSession | null>(
    null,
  );

  const startOpenCode = () => {
    if (!workspace) return;
    setTerminalSession({ cwd: workspace.path, nonce: Date.now() });
  };

  const stopOpenCode = () => setTerminalSession(null);

  return (
    <main className="fixed inset-0 overflow-hidden">
      <WhiteboardCanvas onView={setView} zoomRef={zoomRef} />
      <FloatingWorkspace
        view={view}
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
        onStartOpenCode={startOpenCode}
      />
      {terminalSession && (
        <FloatingTerminal
          view={view}
          session={terminalSession}
          onStop={stopOpenCode}
          onZoomToFit={(rect) => zoomRef.current?.(rect)}
        />
      )}
    </main>
  );
}
