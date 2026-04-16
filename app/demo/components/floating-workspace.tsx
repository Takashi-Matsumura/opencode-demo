"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  FolderOpen,
  RefreshCw,
  Play,
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  Maximize2,
  ShieldCheck,
} from "lucide-react";
import type { View } from "./whiteboard-canvas";

type ScenePos = { x: number; y: number };
type SceneSize = { w: number; h: number };

export type Workspace = { path: string; token: string };

type Entry = {
  name: string;
  isDir: boolean;
  size: number;
  mtimeMs: number;
};

type FilePayload = {
  path: string;
  size: number;
  truncated: boolean;
  content: string;
};

function join(base: string, name: string): string {
  return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
}

async function apiListDir(token: string, path: string): Promise<Entry[]> {
  const res = await fetch(
    `/api/workspace?token=${encodeURIComponent(token)}&path=${encodeURIComponent(path)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { entries: Entry[] };
  return data.entries;
}

async function apiReadFile(token: string, path: string): Promise<FilePayload> {
  const res = await fetch(
    `/api/workspace/file?token=${encodeURIComponent(token)}&path=${encodeURIComponent(path)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as FilePayload;
}

async function apiPickFolder(): Promise<Workspace | null> {
  const res = await fetch("/api/pick-folder", {
    method: "POST",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    path?: string;
    token?: string;
    canceled?: boolean;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  if (data.canceled) return null;
  if (!data.path || !data.token) throw new Error("invalid response");
  return { path: data.path, token: data.token };
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
  entry: Entry;
  depth: number;
  expanded: Set<string>;
  childEntries: Map<string, Entry[]>;
  selectedFile: string | null;
  loadingPaths: Set<string>;
  onToggleDir: (p: string) => void;
  onSelectFile: (p: string) => void;
}) {
  const path = join(parentPath, entry.name);
  const isDir = entry.isDir;
  const isOpen = expanded.has(path);
  const isLoading = loadingPaths.has(path);
  const children = childEntries.get(path);
  const isSelected = selectedFile === path;
  return (
    <div>
      <button
        type="button"
        onClick={() => (isDir ? onToggleDir(path) : onSelectFile(path))}
        className={`flex w-full items-center gap-1 px-2 py-0.5 text-left font-mono text-xs transition-colors ${
          isSelected
            ? "bg-sky-100 text-sky-900"
            : "text-slate-700 hover:bg-slate-100"
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
        title={path}
      >
        <span className="w-3 shrink-0 text-slate-400">
          {isDir ? (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : <span className="h-3 w-3" />}
        </span>
        <span className="shrink-0 text-slate-500">{isDir ? <Folder className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}</span>
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

export default function FloatingWorkspace({
  view,
  workspace,
  onWorkspaceChange,
  onStartOpenCode,
  onStartBusinessOpenCode,
  onZoomToFit,
}: {
  view: View;
  workspace: Workspace | null;
  onWorkspaceChange: (ws: Workspace | null) => void;
  onStartOpenCode: () => void;
  onStartBusinessOpenCode: () => void;
  onZoomToFit?: (rect: { x: number; y: number; w: number; h: number }) => void;
}) {
  const [scenePos, setScenePos] = useState<ScenePos>({ x: 60, y: 60 });
  const [sceneSize, setSceneSize] = useState<SceneSize>({ w: 640, h: 460 });

  useEffect(() => {
    setScenePos({
      x: Math.max(0, (window.innerWidth - 640) / 2),
      y: Math.max(0, (window.innerHeight - 460) / 2),
    });
  }, []);
  const [splitPct, setSplitPct] = useState(45);

  const [childEntries, setChildEntries] = useState<Map<string, Entry[]>>(
    new Map(),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    setScenePos({
      x: Math.max(0, (window.innerWidth - 640) / 2),
      y: Math.max(0, (window.innerHeight - 460) / 2),
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

  const loadDir = useCallback(async (token: string, path: string) => {
    setLoadingPaths((s) => {
      const n = new Set(s);
      n.add(path);
      return n;
    });
    try {
      const entries = await apiListDir(token, path);
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
  }, []);

  const pickFolder = useCallback(async () => {
    setPicking(true);
    setError(null);
    try {
      const ws = await apiPickFolder();
      if (!ws) return;
      onWorkspaceChange(ws);
      setExpanded(new Set([ws.path]));
      setChildEntries(new Map());
      setSelectedFile(null);
      setFileContent(null);
      await loadDir(ws.token, ws.path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPicking(false);
    }
  }, [loadDir, onWorkspaceChange]);

  const onToggleDir = useCallback(
    (p: string) => {
      if (!workspace) return;
      setExpanded((s) => {
        const n = new Set(s);
        if (n.has(p)) {
          n.delete(p);
        } else {
          n.add(p);
          if (!childEntries.has(p)) {
            void loadDir(workspace.token, p);
          }
        }
        return n;
      });
    },
    [childEntries, loadDir, workspace],
  );

  const onSelectFile = useCallback(
    async (p: string) => {
      if (!workspace) return;
      setSelectedFile(p);
      setFileContent(null);
      setFileLoading(true);
      setError(null);
      try {
        const data = await apiReadFile(workspace.token, p);
        setFileContent(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setFileLoading(false);
      }
    },
    [workspace],
  );

  const onRefresh = useCallback(async () => {
    if (!workspace) return;
    const paths = Array.from(expanded);
    await Promise.all(paths.map((p) => loadDir(workspace.token, p)));
    if (selectedFile) {
      try {
        const data = await apiReadFile(workspace.token, selectedFile);
        setFileContent(data);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }, [expanded, loadDir, selectedFile, workspace]);

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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onZoomToFit?.({ x: scenePos.x, y: scenePos.y, w: sceneSize.w, h: sceneSize.h });
            }}
            className="group h-3 w-3 rounded-full bg-[#28c840] hover:brightness-110"
            title="80% フィット表示"
          >
            <Maximize2 className="hidden h-2.5 w-2.5 stroke-[3] text-black/60 group-hover:block" style={{ margin: '0.5px' }} />
          </button>
          <span className="font-mono font-medium text-slate-700">
            workspace
          </span>
        </div>
        <span className="truncate font-mono text-[10px] text-slate-400">
          {workspace?.path ?? "(no folder open)"}
        </span>
      </div>

      <div className="flex flex-nowrap items-center gap-1.5 border-b border-slate-200 bg-white px-2 py-1">
        <button
          type="button"
          onClick={() => void pickFolder()}
          disabled={picking}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-40"
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{picking ? "選択中…" : "フォルダを選択…"}</span>
        </button>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={!workspace}
          className="inline-flex shrink-0 items-center rounded border border-slate-300 bg-white p-1 text-slate-700 hover:bg-slate-50 disabled:opacity-30"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onStartOpenCode}
            disabled={!workspace}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-[#15151c] bg-[#15151c] px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#2a2a35] disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            title={
              workspace
                ? `Coding を ${workspace.path} で起動`
                : "先にフォルダを選択してください"
            }
          >
            <Play className="h-3.5 w-3.5 shrink-0" />
            Coding
          </button>
          <button
            type="button"
            onClick={onStartBusinessOpenCode}
            disabled={!workspace}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-[#217346] bg-[#217346] px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#1a5c38] disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            title={
              workspace
                ? `Business を ${workspace.path} で起動`
                : "先にフォルダを選択してください"
            }
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Business
          </button>
        </div>
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
          {workspace ? (
            <TreeRootRow
              rootPath={workspace.path}
              expanded={expanded}
              childEntries={childEntries}
              selectedFile={selectedFile}
              loadingPaths={loadingPaths}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
            />
          ) : (
            <div className="px-3 py-2 font-mono text-xs text-slate-400">
              「フォルダを選択…」を押すと Finder が開きます
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

function TreeRootRow({
  rootPath,
  expanded,
  childEntries,
  selectedFile,
  loadingPaths,
  onToggleDir,
  onSelectFile,
}: {
  rootPath: string;
  expanded: Set<string>;
  childEntries: Map<string, Entry[]>;
  selectedFile: string | null;
  loadingPaths: Set<string>;
  onToggleDir: (p: string) => void;
  onSelectFile: (p: string) => void;
}) {
  const isOpen = expanded.has(rootPath);
  const isLoading = loadingPaths.has(rootPath);
  const children = childEntries.get(rootPath);
  const rootName = rootPath.split("/").filter(Boolean).pop() ?? rootPath;
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggleDir(rootPath)}
        className="flex w-full items-center gap-1 px-2 py-0.5 text-left font-mono text-xs text-slate-700 hover:bg-slate-100"
        title={rootPath}
      >
        <span className="w-3 shrink-0 text-slate-400">
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <span className="shrink-0 text-slate-500"><Folder className="h-3.5 w-3.5" /></span>
        <span className="truncate font-medium">{rootName}</span>
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
