"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import dynamic from "next/dynamic";
import { X, Minus, Maximize2, ArrowUpDown } from "lucide-react";
import type { View, SceneRect } from "./whiteboard-canvas";

const XtermView = dynamic(() => import("./xterm-view"), { ssr: false });

type ScenePos = { x: number; y: number };
type SceneSize = { w: number; h: number };

export type TerminalSession = { cwd: string; nonce: number };

export default function FloatingTerminal({
  view,
  session,
  onStop,
  onZoomToFit,
}: {
  view: View;
  session: TerminalSession | null;
  onStop: () => void;
  onZoomToFit?: (rect: SceneRect) => void;
}) {
  const [scenePos, setScenePos] = useState<ScenePos>({ x: 80, y: 80 });
  const [sceneSize, setSceneSize] = useState<SceneSize>({ w: 720, h: 440 });
  const [minimized, setMinimized] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [backNonce, setBackNonce] = useState(0);

  useEffect(() => {
    setScenePos({
      x: Math.max(0, (window.innerWidth - 720) / 2),
      y: Math.max(0, (window.innerHeight - 440) / 2),
    });
  }, []);

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

  const headerBar = (title: string) => (
    <div
      className="flex h-9 cursor-grab items-center gap-2 rounded-t-lg border-b border-white/10 bg-[#15151c] px-3 text-xs text-white/70 active:cursor-grabbing select-none"
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
        className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white/80"
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
          className="flex flex-col rounded-lg border border-white/10 bg-[#0b0b0f] shadow-2xl shadow-black/50 backdrop-blur"
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
          }}
        >
          {headerBar("opencode")}
          {!minimized && (
            <div className="relative flex-1 overflow-hidden rounded-b-lg">
              {session ? (
                <XtermView key={session.nonce} cwd={session.cwd} />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#0b0b0f] px-6 text-center font-mono text-xs text-white/50">
                  Workspace でフォルダを選んで「OpenCode」ボタンを押してください
                </div>
              )}
              <div
                className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                style={{
                  background:
                    "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.25) 50%)",
                }}
              />
            </div>
          )}
        </div>

        {/* Back: Shell / Settings */}
        <div
          className="flex flex-col rounded-lg border border-white/10 bg-[#0b0b0f] shadow-2xl shadow-black/50 backdrop-blur"
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {headerBar("shell")}
          {!minimized && (
            <div className="relative flex-1 overflow-hidden rounded-b-lg">
              {backNonce > 0 && session ? (
                <XtermView key={backNonce} cwd={session.cwd} cmd="shell" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#0b0b0f] px-6 text-center font-mono text-xs text-white/50">
                  OpenCode を起動すると、シェルが使えます
                </div>
              )}
              <div
                className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                style={{
                  background:
                    "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.25) 50%)",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
