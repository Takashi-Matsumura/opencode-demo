"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import type { View } from "./whiteboard-canvas";

type ScenePos = { x: number; y: number };
type SceneSize = { w: number; h: number };

type EntryHandle = {
  name: string;
  kind: "file" | "directory";
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
};

type FilePayload = {
  path: string;
  size: number;
  truncated: boolean;
  content: string;
};

const MAX_BYTES = 512 * 1024;

function join(base: string, name: string): string {
  return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
}

function looksBinary(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

async function readEntries(
  dir: FileSystemDirectoryHandle,
): Promise<EntryHandle[]> {
  const out: EntryHandle[] = [];
  const iter = dir as unknown as AsyncIterable<
    [string, FileSystemFileHandle | FileSystemDirectoryHandle]
  >;
  for await (const [name, handle] of iter) {
    out.push({ name, kind: handle.kind, handle });
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

async function readFile(
  handle: FileSystemFileHandle,
  virtualPath: string,
): Promise<FilePayload> {
  const file = await handle.getFile();
  const size = file.size;
  const truncated = size > MAX_BYTES;
  const slice = truncated ? file.slice(0, MAX_BYTES) : file;
  const buf = new Uint8Array(await slice.arrayBuffer());
  if (looksBinary(buf)) {
    throw new Error("binary file not supported");
  }
  const content = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  return { path: virtualPath, size, truncated, content };
}

function TreeRow({
  parentPath,
  entry,
  depth,
  expanded,
  childEntries,
  selectedFile,
  loadingPaths,
  onToggleDir,
  onSelectFile,
}: {
  parentPath: string;
  entry: EntryHandle;
  depth: number;
  expanded: Set<string>;
  childEntries: Map<string, EntryHandle[]>;
  selectedFile: string | null;
  loadingPaths: Set<string>;
  onToggleDir: (p: string, handle: FileSystemDirectoryHandle | null) => void;
  onSelectFile: (p: string, handle: FileSystemFileHandle) => void;
}) {
  const path = join(parentPath, entry.name);
  const isDir = entry.kind === "directory";
  const isOpen = expanded.has(path);
  const isLoading = loadingPaths.has(path);
  const children = childEntries.get(path);
  const isSelected = selectedFile === path;
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isDir) {
            onToggleDir(path, entry.handle as FileSystemDirectoryHandle);
          } else {
            onSelectFile(path, entry.handle as FileSystemFileHandle);
          }
        }}
        className={`flex w-full items-center gap-1 px-2 py-0.5 text-left font-mono text-xs transition-colors ${
          isSelected
            ? "bg-sky-100 text-sky-900"
            : "text-slate-700 hover:bg-slate-100"
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
        title={path}
      >
        <span className="w-3 shrink-0 text-slate-400">
          {isDir ? (isOpen ? "▾" : "▸") : " "}
        </span>
        <span className="shrink-0">{isDir ? "📁" : "📄"}</span>
        <span className="truncate">{entry.name}</span>
        {isLoading && <span className="ml-auto text-slate-400">…</span>}
      </button>
      {isDir && isOpen && children && (
        <div>
          {children.map((c) => (
            <TreeRow
              key={join(path, c.name)}
              parentPath={path}
              entry={c}
              depth={depth + 1}
              expanded={expanded}
              childEntries={childEntries}
              selectedFile={selectedFile}
              loadingPaths={loadingPaths}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
            />
          ))}
          {children.length === 0 && (
            <div
              className="px-2 py-0.5 font-mono text-xs text-slate-400"
              style={{ paddingLeft: 8 + (depth + 1) * 12 }}
            >
              (empty)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type WindowWithPicker = Window & {
  showDirectoryPicker?: (opts?: {
    mode?: "read" | "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
};

export default function FloatingWorkspace({ view }: { view: View }) {
  const [scenePos, setScenePos] = useState<ScenePos>({ x: 60, y: 60 });
  const [sceneSize, setSceneSize] = useState<SceneSize>({ w: 640, h: 460 });
  const [splitPct, setSplitPct] = useState(45);

  const [rootHandle, setRootHandle] =
    useState<FileSystemDirectoryHandle | null>(null);
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [childEntries, setChildEntries] = useState<Map<string, EntryHandle[]>>(
    new Map(),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [pickerSupported, setPickerSupported] = useState(true);

  useEffect(() => {
    setScenePos({
      x: Math.max(0, (window.innerWidth - 640) / 2 - 420),
      y: Math.max(0, (window.innerHeight - 460) / 2),
    });
    setPickerSupported(
      typeof (window as WindowWithPicker).showDirectoryPicker === "function",
    );
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
  const splitRef = useRef<{
    sx: number;
    startPct: number;
    containerW: number;
  } | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const onHeaderPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button,input")) return;
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
      w: Math.max(360, r.sw + (e.clientX - r.sx) / view.zoom),
      h: Math.max(220, r.sh + (e.clientY - r.sy) / view.zoom),
    });
  };

  const onResizePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    resizeRef.current = null;
  };

  const onSplitPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    splitRef.current = {
      sx: e.clientX,
      startPct: splitPct,
      containerW: rect.width / view.zoom,
    };
  };

  const onSplitPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!splitRef.current) return;
    const s = splitRef.current;
    const deltaPct = ((e.clientX - s.sx) / view.zoom / s.containerW) * 100;
    const next = Math.max(15, Math.min(85, s.startPct + deltaPct));
    setSplitPct(next);
  };

  const onSplitPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    splitRef.current = null;
  };

  const loadDir = useCallback(
    async (path: string, dirHandle: FileSystemDirectoryHandle) => {
      setLoadingPaths((s) => {
        const n = new Set(s);
        n.add(path);
        return n;
      });
      try {
        const entries = await readEntries(dirHandle);
        setChildEntries((m) => {
          const n = new Map(m);
          n.set(path, entries);
          return n;
        });
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingPaths((s) => {
          const n = new Set(s);
          n.delete(path);
          return n;
        });
      }
    },
    [],
  );

  const openPicker = useCallback(async () => {
    const w = window as WindowWithPicker;
    if (!w.showDirectoryPicker) {
      setError(
        "このブラウザはフォルダピッカー (File System Access API) に対応していません。Chrome / Edge / Arc をお試しください。",
      );
      return;
    }
    try {
      const handle = await w.showDirectoryPicker({ mode: "read" });
      const path = handle.name;
      setRootHandle(handle);
      setRootPath(path);
      setExpanded(new Set([path]));
      setChildEntries(new Map());
      setSelectedFile(null);
      setFileContent(null);
      setError(null);
      await loadDir(path, handle);
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") return;
      setError(err.message);
    }
  }, [loadDir]);

  const onToggleDir = useCallback(
    (p: string, handle: FileSystemDirectoryHandle | null) => {
      setExpanded((s) => {
        const n = new Set(s);
        if (n.has(p)) {
          n.delete(p);
        } else {
          n.add(p);
          if (!childEntries.has(p) && handle) {
            void loadDir(p, handle);
          }
        }
        return n;
      });
    },
    [childEntries, loadDir],
  );

  const onSelectFile = useCallback(
    async (p: string, handle: FileSystemFileHandle) => {
      setSelectedFile(p);
      setFileContent(null);
      setFileLoading(true);
      setError(null);
      try {
        const data = await readFile(handle, p);
        setFileContent(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setFileLoading(false);
      }
    },
    [],
  );

  const refreshEntry = useCallback(
    async (path: string) => {
      if (path === rootPath && rootHandle) {
        await loadDir(path, rootHandle);
        return;
      }
      // walk from root
      if (!rootHandle || !rootPath) return;
      const parts = path.slice(rootPath.length).split("/").filter(Boolean);
      let cur: FileSystemDirectoryHandle = rootHandle;
      try {
        for (const seg of parts) {
          cur = await cur.getDirectoryHandle(seg);
        }
        await loadDir(path, cur);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [loadDir, rootHandle, rootPath],
  );

  const onRefresh = useCallback(async () => {
    const paths = Array.from(expanded);
    await Promise.all(paths.map((p) => refreshEntry(p)));
    if (selectedFile && rootHandle && rootPath) {
      const parts = selectedFile
        .slice(rootPath.length)
        .split("/")
        .filter(Boolean);
      const fileName = parts.pop();
      if (!fileName) return;
      let cur: FileSystemDirectoryHandle = rootHandle;
      try {
        for (const seg of parts) {
          cur = await cur.getDirectoryHandle(seg);
        }
        const fh = await cur.getFileHandle(fileName);
        const data = await readFile(fh, selectedFile);
        setFileContent(data);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }, [expanded, refreshEntry, rootHandle, rootPath, selectedFile]);

  const left = (scenePos.x + view.x) * view.zoom;
  const top = (scenePos.y + view.y) * view.zoom;

  return (
    <div
      className="fixed z-40 flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl shadow-slate-900/20"
      style={{
        left: 0,
        top: 0,
        width: sceneSize.w,
        height: sceneSize.h,
        transform: `translate(${left}px, ${top}px) scale(${view.zoom})`,
        transformOrigin: "top left",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex h-9 cursor-grab items-center justify-between gap-2 rounded-t-lg border-b border-slate-200 bg-slate-50 px-3 text-xs text-slate-600 active:cursor-grabbing select-none"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
      >
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
          <span className="font-mono font-medium text-slate-700">
            workspace
          </span>
        </div>
        <span className="truncate font-mono text-[10px] text-slate-400">
          {rootPath ?? "(no folder open)"}
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
        <button
          type="button"
          onClick={() => void openPicker()}
          disabled={!pickerSupported}
          className="rounded border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-40"
        >
          📂 フォルダを選択…
        </button>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={!rootHandle}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-30"
          title="Refresh"
        >
          🔄
        </button>
        <span className="ml-auto truncate font-mono text-[10px] text-slate-400">
          {pickerSupported
            ? "Finder でフォルダを選ぶと、その配下のみアクセスできます"
            : "このブラウザは非対応"}
        </span>
      </div>

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-3 py-1 font-mono text-[11px] text-rose-700">
          {error}
        </div>
      )}

      <div ref={bodyRef} className="flex min-h-0 flex-1">
        <div
          className="min-w-0 overflow-auto border-r border-slate-200 bg-slate-50/60 py-1"
          style={{ width: `${splitPct}%` }}
        >
          {rootHandle && rootPath ? (
            <TreeNodeRoot
              rootPath={rootPath}
              rootHandle={rootHandle}
              expanded={expanded}
              childEntries={childEntries}
              selectedFile={selectedFile}
              loadingPaths={loadingPaths}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
            />
          ) : (
            <div className="px-3 py-2 font-mono text-xs text-slate-400">
              「フォルダを選択…」から開始してください
            </div>
          )}
        </div>
        <div
          className="w-1 shrink-0 cursor-ew-resize bg-slate-200 hover:bg-sky-300"
          onPointerDown={onSplitPointerDown}
          onPointerMove={onSplitPointerMove}
          onPointerUp={onSplitPointerUp}
        />
        <div className="relative min-w-0 flex-1 overflow-auto bg-white">
          {fileLoading && (
            <div className="px-3 py-2 font-mono text-xs text-slate-400">
              reading…
            </div>
          )}
          {!fileLoading && fileContent && (
            <>
              <div className="sticky top-0 border-b border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[10px] text-slate-500">
                {fileContent.path.split("/").pop()}
                {fileContent.truncated && (
                  <span className="ml-2 text-amber-600">
                    (truncated to 512KB)
                  </span>
                )}
              </div>
              <pre className="px-3 py-2 font-mono text-[11px] whitespace-pre-wrap break-words text-slate-800">
                {fileContent.content}
              </pre>
            </>
          )}
          {!fileLoading && !fileContent && (
            <div className="px-3 py-2 font-mono text-xs text-slate-400">
              ファイルを選択
            </div>
          )}
          <div
            className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            style={{
              background:
                "linear-gradient(135deg, transparent 50%, rgba(100,116,139,0.4) 50%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TreeNodeRoot({
  rootPath,
  rootHandle,
  expanded,
  childEntries,
  selectedFile,
  loadingPaths,
  onToggleDir,
  onSelectFile,
}: {
  rootPath: string;
  rootHandle: FileSystemDirectoryHandle;
  expanded: Set<string>;
  childEntries: Map<string, EntryHandle[]>;
  selectedFile: string | null;
  loadingPaths: Set<string>;
  onToggleDir: (p: string, handle: FileSystemDirectoryHandle | null) => void;
  onSelectFile: (p: string, handle: FileSystemFileHandle) => void;
}) {
  const isOpen = expanded.has(rootPath);
  const isLoading = loadingPaths.has(rootPath);
  const children = childEntries.get(rootPath);
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggleDir(rootPath, rootHandle)}
        className="flex w-full items-center gap-1 px-2 py-0.5 text-left font-mono text-xs text-slate-700 hover:bg-slate-100"
        title={rootPath}
      >
        <span className="w-3 shrink-0 text-slate-400">
          {isOpen ? "▾" : "▸"}
        </span>
        <span className="shrink-0">📁</span>
        <span className="truncate font-medium">{rootHandle.name}</span>
        {isLoading && <span className="ml-auto text-slate-400">…</span>}
      </button>
      {isOpen && children && (
        <div>
          {children.map((c) => (
            <TreeRow
              key={join(rootPath, c.name)}
              parentPath={rootPath}
              entry={c}
              depth={1}
              expanded={expanded}
              childEntries={childEntries}
              selectedFile={selectedFile}
              loadingPaths={loadingPaths}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
            />
          ))}
          {children.length === 0 && (
            <div
              className="px-2 py-0.5 font-mono text-xs text-slate-400"
              style={{ paddingLeft: 20 }}
            >
              (empty)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
