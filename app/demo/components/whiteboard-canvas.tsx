"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export type View = { x: number; y: number; zoom: number };

export default function WhiteboardCanvas({
  onView,
}: {
  onView?: (v: View) => void;
}) {
  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onPointerDown={() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
      }}
    >
      <style>{`
        .excalidraw .App-menu_top,
        .excalidraw .layer-ui__wrapper__footer-right,
        .excalidraw .welcome-screen-center {
          display: none !important;
        }
      `}</style>
      <Excalidraw
        gridModeEnabled
        onScrollChange={(scrollX, scrollY, zoom) =>
          onView?.({ x: scrollX, y: scrollY, zoom: zoom.value })
        }
      />
    </div>
  );
}
