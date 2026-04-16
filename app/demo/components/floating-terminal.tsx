"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import dynamic from "next/dynamic";
import type { View } from "./whiteboard-canvas";

const XtermView = dynamic(() => import("./xterm-view"), { ssr: false });

type ScenePos = { x: number; y: number };
type SceneSize = { w: number; h: number };

export default function FloatingTerminal({ view }: { view: View }) {
  const [scenePos, setScenePos] = useState<ScenePos>({ x: 80, y: 80 });
  const [sceneSize, setSceneSize] = useState<SceneSize>({ w: 720, h: 440 });
  const [minimized, setMinimized] = useState(false);

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

  const left = (scenePos.x + view.x) * view.zoom;
  const top = (scenePos.y + view.y) * view.zoom;

  return (
    <div
      className="fixed z-50 flex flex-col rounded-lg border border-white/10 bg-[#0b0b0f] shadow-2xl shadow-black/50 backdrop-blur"
      style={{
        left: 0,
        top: 0,
        width: sceneSize.w,
        height: minimized ? 36 : sceneSize.h,
        transform: `translate(${left}px, ${top}px) scale(${view.zoom})`,
        transformOrigin: "top left",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex h-9 cursor-grab items-center justify-between gap-2 rounded-t-lg border-b border-white/10 bg-[#15151c] px-3 text-xs text-white/70 active:cursor-grabbing select-none"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
      >
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          <span className="ml-2 font-mono">opencode</span>
        </div>
        <button
          type="button"
          onClick={() => setMinimized((m) => !m)}
          className="rounded px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          {minimized ? "▢" : "—"}
        </button>
      </div>

      {!minimized && (
        <div className="relative flex-1 overflow-hidden rounded-b-lg">
          <XtermView />
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
  );
}
