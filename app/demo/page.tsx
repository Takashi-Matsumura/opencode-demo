"use client";

import dynamic from "next/dynamic";

const WhiteboardCanvas = dynamic(
  () => import("./components/whiteboard-canvas"),
  { ssr: false },
);
const FloatingTerminal = dynamic(
  () => import("./components/floating-terminal"),
  { ssr: false },
);

export default function DemoPage() {
  return (
    <main className="fixed inset-0 overflow-hidden">
      <WhiteboardCanvas />
      <FloatingTerminal />
    </main>
  );
}
