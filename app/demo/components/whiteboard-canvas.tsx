"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export default function WhiteboardCanvas() {
  return (
    <div className="absolute inset-0">
      <Excalidraw />
    </div>
  );
}
