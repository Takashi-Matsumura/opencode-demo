"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { View } from "./components/whiteboard-canvas";

const WhiteboardCanvas = dynamic(
  () => import("./components/whiteboard-canvas"),
  { ssr: false },
);
const FloatingTerminal = dynamic(
  () => import("./components/floating-terminal"),
  { ssr: false },
);

export default function DemoPage() {
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });

  return (
    <main className="fixed inset-0 overflow-hidden">
      <WhiteboardCanvas onView={setView} />
      <FloatingTerminal
        view={view}
        session={null}
        onStop={() => {}}
      />
    </main>
  );
}
