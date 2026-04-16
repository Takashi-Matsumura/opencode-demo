"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import dynamic from "next/dynamic";
import { X, Minus, Maximize2, ArrowUpDown, Plus } from "lucide-react";
import type { View, SceneRect } from "./whiteboard-canvas";
import OpenCodeSettings from "./opencode-settings";

const XtermView = dynamic(() => import("./xterm-view"), { ssr: false });

type ScenePos = { x: number; y: number };
type SceneSize = { w: number; h: number };

export type TerminalSession = { cwd: string; nonce: number };
export type TerminalVariant = "coding" | "business";

export default function FloatingTerminal({
  view,
  session,
  onStop,
  onZoomToFit,
  workspaceCwd,
  workspaceToken,
  variant = "coding",
  label = "opencode",
  slot = "left",
}: {
  view: View;
  session: TerminalSession | null;
  onStop: () => void;
  onZoomToFit?: (rect: SceneRect) => void;
  workspaceCwd?: string;
  workspaceToken?: string;
  variant?: TerminalVariant;
  label?: string;
  slot?: "left" | "right";
}) {
  const [scenePos, setScenePos] = useState<ScenePos>({ x: 80, y: 80 });
  const [sceneSize, setSceneSize] = useState<SceneSize>({ w: 720, h: 440 });
  const [minimized, setMinimized] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [backNonce, setBackNonce] = useState(0);
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window === "undefined") return 13;
    const saved = localStorage.getItem(`terminal-fontSize-${variant}`);
    return saved ? Number(saved) : 13;
  });
  const [fontNonce, setFontNonce] = useState(0);

  const changeFontSize = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(28, Math.max(10, prev + delta));
      localStorage.setItem(`terminal-fontSize-${variant}`, String(next));
      setFontNonce(Date.now());
      return next;
    });
  };

  useEffect(() => {
    const cx = slot === "right"
      ? window.innerWidth * 0.55
      : window.innerWidth * 0.25 - 360;
    setScenePos({
      x: Math.max(0, cx),
      y: Math.max(0, (window.innerHeight - 440) / 2),
    });
  }, [slot]);

  const dragRef = useRef<{
    sx: number;
    sy: number;
    px: number;
    py: number;
  } | null>(null);
  const resizeRef = useRef<{
    sx: number;
    sy: number;
    sw: number;
    sh: number;
  } | null>(null);

  const onHeaderPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      px: scenePos.x,
      py: scenePos.y,
    };
  };

  const onHeaderPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    setScenePos({
      x: d.px + (e.clientX - d.sx) / view.zoom,
      y: d.py + (e.clientY - d.sy) / view.zoom,
    });
  };

  const onHeaderPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  const onResizePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      sw: sceneSize.w,
      sh: sceneSize.h,
    };
  };

  const onResizePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    const r = resizeRef.current;
    setSceneSize({
      w: Math.max(320, r.sw + (e.clientX - r.sx) / view.zoom),
      h: Math.max(180, r.sh + (e.clientY - r.sy) / view.zoom),
    });
  };

  const onResizePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    resizeRef.current = null;
  };

  const handleFlip = () => {
    if (!flipped && backNonce === 0) {
      setBackNonce(Date.now());
    }
    setFlipped((f) => !f);
  };

  const left = (scenePos.x + view.x) * view.zoom;
  const top = (scenePos.y + view.y) * view.zoom;

  const isBusiness = variant === "business";

  const headerBar = (title: string) => (
    <div
      className={`flex h-9 cursor-grab items-center gap-2 rounded-t-lg border-b px-3 text-xs active:cursor-grabbing select-none ${
        isBusiness
          ? "border-[#b7d9b7] bg-[#217346] text-white"
          : "border-white/10 bg-[#15151c] text-white/70 border-t-2 border-t-emerald-500"
      }`}
      onPointerDown={onHeaderPointerDown}
      onPointerMove={onHeaderPointerMove}
      onPointerUp={onHeaderPointerUp}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onStop}
          className="group h-3 w-3 rounded-full bg-[#ff5f57] hover:brightness-110"
          title="OpenCode を停止"
        >
          <X className="hidden h-3 w-3 stroke-[3] text-black/60 group-hover:block" />
        </button>
        <button
          type="button"
          onClick={() => setMinimized((m) => !m)}
          className="group h-3 w-3 rounded-full bg-[#febc2e] hover:brightness-110"
          title={minimized ? "元に戻す" : "最小化"}
        >
          <Minus className="hidden h-3 w-3 stroke-[3] text-black/60 group-hover:block" />
        </button>
        <button
          type="button"
          onClick={() =>
            onZoomToFit?.({
              x: scenePos.x,
              y: scenePos.y,
              w: sceneSize.w,
              h: sceneSize.h,
            })
          }
          className="group h-3 w-3 rounded-full bg-[#28c840] hover:brightness-110"
          title="80% フィット表示"
        >
          <Maximize2 className="hidden h-2.5 w-2.5 stroke-[3] text-black/60 group-hover:block" style={{ margin: '0.5px' }} />
        </button>
      </div>
      <span className="ml-1 flex-1 font-mono">{title}</span>
      <button
        type="button"
        onClick={handleFlip}
        className={`rounded p-0.5 ${isBusiness ? "text-white/70 hover:bg-white/20 hover:text-white" : "text-white/50 hover:bg-white/10 hover:text-white/80"}`}
        title={flipped ? "OpenCode に戻す" : "設定・シェルを開く"}
      >
        <ArrowUpDown className="h-3.5 w-3.5 rotate-90" />
      </button>
    </div>
  );


  return (
    <div
      className="fixed z-50"
      style={{
        left: 0,
        top: 0,
        width: sceneSize.w,
        height: minimized ? 36 : sceneSize.h,
        transform: `translate(${left}px, ${top}px) scale(${view.zoom})`,
        transformOrigin: "top left",
        perspective: 1200,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.6s ease-in-out",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front: OpenCode */}
        <div
          className={`flex flex-col rounded-lg shadow-2xl backdrop-blur ${
            isBusiness
              ? "border border-[#b7d9b7] shadow-green-900/20"
              : "border border-white/10 shadow-black/50"
          }`}
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            backgroundColor: isBusiness ? "#eaf5ea" : "#0b0b0f",
          }}
        >
          {headerBar(label)}
          {!minimized && (
            <div
              className="relative flex-1 overflow-hidden rounded-b-lg bg-[#0b0b0f]"
              style={isBusiness ? {
                filter: "invert(0.93) sepia(0.2) hue-rotate(75deg) saturate(1.8) contrast(1.15) brightness(1.02)",
              } : undefined}
            >
              {session ? (
                <XtermView key={`${session.nonce}-${fontNonce}`} cwd={session.cwd} fontSize={fontSize} />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#0b0b0f] px-6 text-center font-mono text-xs text-white/50">
                  Workspace でフォルダを選んで「{isBusiness ? "Business" : "Coding"}」ボタンを押してください
                </div>
              )}
              <div
                className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                style={{
                  background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.25) 50%)",
                }}
              />
            </div>
          )}
        </div>

        {/* Back: Shell / Settings */}
        <div
          className={`flex flex-col rounded-lg shadow-2xl backdrop-blur ${
            isBusiness
              ? "border border-[#b7d9b7] shadow-green-900/20"
              : "border border-white/10 shadow-black/50"
          }`}
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            backgroundColor: isBusiness ? "#eaf5ea" : "#0b0b0f",
          }}
        >
          {headerBar(`${label} — settings / shell`)}
          {!minimized && (
            <div
              className="relative flex flex-1 overflow-hidden rounded-b-lg bg-[#0b0b0f]"
              style={isBusiness ? {
                filter: "invert(0.93) sepia(0.2) hue-rotate(75deg) saturate(1.8) contrast(1.15) brightness(1.02)",
              } : undefined}
            >
              {/* Left: Settings */}
              <div className="w-1/2 overflow-y-auto border-r border-white/10">
                {/* Font Size */}
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <span className="font-mono text-[11px] text-white/70">Font Size</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => changeFontSize(-1)}
                      className="flex h-5 w-5 items-center justify-center rounded bg-white/10 text-white/70 hover:bg-white/20"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-[2rem] text-center font-mono text-xs text-white">{fontSize}px</span>
                    <button
                      type="button"
                      onClick={() => changeFontSize(1)}
                      className="flex h-5 w-5 items-center justify-center rounded bg-white/10 text-white/70 hover:bg-white/20"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {workspaceCwd && workspaceToken ? (
                  <OpenCodeSettings cwd={workspaceCwd} token={workspaceToken} />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center font-mono text-xs text-white/50">
                    Workspace でフォルダを開くと設定が表示されます
                  </div>
                )}
              </div>
              {/* Right: Shell */}
              <div className="relative w-1/2">
                {backNonce > 0 && session ? (
                  <XtermView key={`${backNonce}-${fontNonce}`} cwd={session.cwd} cmd="shell" fontSize={fontSize} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#0b0b0f] px-6 text-center font-mono text-xs text-white/50">
                    OpenCode を起動すると、シェルが使えます
                  </div>
                )}
              </div>
              <div
                className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                style={{
                  background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.25) 50%)",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
