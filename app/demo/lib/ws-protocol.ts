export type ClientMessage =
  | { type: "data"; data: string }
  | { type: "resize"; cols: number; rows: number };

export const PTY_WS_URL =
  process.env.NEXT_PUBLIC_PTY_WS_URL ?? "ws://127.0.0.1:4097";
