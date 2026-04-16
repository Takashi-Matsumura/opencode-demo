"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { View } from "./demo/components/whiteboard-canvas";

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
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  return (
    <main className="fixed inset-0 overflow-hidden">
      <WhiteboardCanvas onView={setView} />
      <FloatingWorkspace view={view} />
      <FloatingTerminal view={view} />
    </main>
  );
}
