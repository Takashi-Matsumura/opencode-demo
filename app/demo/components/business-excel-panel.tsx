"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, RefreshCw, Copy, Check, AlertCircle } from "lucide-react";

type Entry = {
  name: string;
  isDir: boolean;
  size: number;
  mtimeMs: number;
};

type ExcelFile = {
  path: string;
  name: string;
  size: number;
  mtimeMs: number;
};

type SheetPayload = {
  name: string;
  rows: number;
  cols: number;
  headers: string[];
  data: string[][];
  truncated: boolean;
};

type ExcelResponse = {
  path: string;
  size: number;
  sheetNames: string[];
  activeSheet: SheetPayload;
};

const EXCEL_EXT = /\.(xlsx|xls|xlsm|csv)$/i;
const MAX_DEPTH = 5;
const SKIP_DIRS = new Set([".git", "node_modules", ".opencode", ".next", "dist"]);

async function walkForExcel(
  cwd: string,
  token: string,
  files: ExcelFile[],
  depth: number,
): Promise<void> {
  if (depth > MAX_DEPTH || files.length > 500) return;
  const res = await fetch(
    `/api/workspace?token=${encodeURIComponent(token)}&path=${encodeURIComponent(cwd)}`,
  );
  if (!res.ok) return;
  const data = (await res.json()) as { entries?: Entry[] };
  if (!data.entries) return;
  for (const e of data.entries) {
    const child = `${cwd}/${e.name}`;
    if (e.isDir) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      await walkForExcel(child, token, files, depth + 1);
    } else if (EXCEL_EXT.test(e.name)) {
      files.push({ path: child, name: e.name, size: e.size, mtimeMs: e.mtimeMs });
    }
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTo(root: string, full: string): string {
  if (full.startsWith(root + "/")) return full.slice(root.length + 1);
  return full;
}

export default function BusinessExcelPanel({
  cwd,
  token,
}: {
  cwd: string;
  token: string;
}) {
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ExcelResponse | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const out: ExcelFile[] = [];
      await walkForExcel(cwd, token, out, 0);
      out.sort((a, b) => b.mtimeMs - a.mtimeMs);
      setFiles(out);
    } catch (e) {
      setListError((e as Error).message ?? "list failed");
    } finally {
      setListLoading(false);
    }
  }, [cwd, token]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadSheet = useCallback(
    async (path: string, sheetName?: string) => {
      setSheetLoading(true);
      setSheetError(null);
      try {
        const url = new URL("/api/workspace/excel", window.location.origin);
        url.searchParams.set("token", token);
        url.searchParams.set("path", path);
        if (sheetName) url.searchParams.set("sheet", sheetName);
        const res = await fetch(url.toString());
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as ExcelResponse;
        setSheet(data);
      } catch (e) {
        setSheet(null);
        setSheetError((e as Error).message ?? "load failed");
      } finally {
        setSheetLoading(false);
      }
    },
    [token],
  );

  const selectFile = useCallback(
    (path: string) => {
      setSelected(path);
      loadSheet(path);
    },
    [loadSheet],
  );

  const copyPrompt = useCallback(async () => {
    if (!selected) return;
    const rel = relativeTo(cwd, selected);
    const prompt = `read_excel ツールで ${rel} を読み、シートの概要と気付いた傾向を日本語で要約してください。`;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [selected, cwd]);

  const relSelected = useMemo(
    () => (selected ? relativeTo(cwd, selected) : null),
    [selected, cwd],
  );

  return (
    <div className="excel-panel flex h-full flex-col overflow-hidden bg-[#0b0b0f] text-xs text-white/80">
      <style>{`
        .excel-panel ::-webkit-scrollbar { width: 6px; height: 6px; }
        .excel-panel ::-webkit-scrollbar-track { background: transparent; }
        .excel-panel ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        .excel-panel ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>

      {/* Top: File list */}
      <div className="flex h-[34%] min-h-[90px] flex-col overflow-hidden border-b border-white/10">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-3 py-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/50">
            Excel Files {files.length > 0 && `(${files.length})`}
          </span>
          <button
            type="button"
            onClick={refresh}
            className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
            title="再スキャン"
          >
            <RefreshCw className={`h-3 w-3 ${listLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {listError ? (
            <div className="flex items-start gap-1.5 px-3 py-2 text-[11px] text-red-400">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>{listError}</span>
            </div>
          ) : files.length === 0 && !listLoading ? (
            <div className="px-3 py-2 text-[11px] text-white/40">
              ワークスペース内に .xlsx / .xls / .xlsm / .csv が見つかりません
            </div>
          ) : (
            <ul>
              {files.map((f) => {
                const rel = relativeTo(cwd, f.path);
                const isSelected = selected === f.path;
                return (
                  <li key={f.path}>
                    <button
                      type="button"
                      onClick={() => selectFile(f.path)}
                      className={`flex w-full items-center gap-1.5 px-3 py-1 text-left font-mono text-[11px] transition-colors ${
                        isSelected
                          ? "bg-sky-600/30 text-white"
                          : "text-white/70 hover:bg-white/5"
                      }`}
                      title={f.path}
                    >
                      <FileSpreadsheet className="h-3 w-3 flex-shrink-0 text-emerald-400" />
                      <span className="truncate">{rel}</span>
                      <span className="ml-auto flex-shrink-0 text-[10px] text-white/40">
                        {formatSize(f.size)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom: Sheet preview */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Sheet tabs + path */}
        <div className="flex flex-shrink-0 flex-col border-b border-white/10">
          {relSelected ? (
            <>
              <div className="flex items-center justify-between px-3 py-1 border-b border-white/5">
                <span className="truncate font-mono text-[10px] text-white/50" title={selected ?? ""}>
                  {relSelected}
                </span>
                <button
                  type="button"
                  onClick={copyPrompt}
                  className={`inline-flex flex-shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${
                    copied
                      ? "bg-green-600 text-white"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                  title="AI への要約依頼プロンプトをクリップボードにコピー"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy prompt"}
                </button>
              </div>
              {sheet && sheet.sheetNames.length > 0 && (
                <div className="flex flex-shrink-0 items-center gap-0.5 overflow-x-auto px-2 py-1">
                  {sheet.sheetNames.map((name) => {
                    const active = name === sheet.activeSheet.name;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => selected && loadSheet(selected, name)}
                        className={`flex-shrink-0 rounded px-2 py-0.5 font-mono text-[10px] transition-colors ${
                          active
                            ? "bg-emerald-600/40 text-white"
                            : "bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="px-3 py-2 font-mono text-[10px] text-white/40">
              ファイルを選択するとプレビューが表示されます
            </div>
          )}
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          {sheetLoading ? (
            <div className="flex h-full items-center justify-center text-[11px] text-white/40">
              Loading...
            </div>
          ) : sheetError ? (
            <div className="flex items-start gap-1.5 px-3 py-2 text-[11px] text-red-400">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>{sheetError}</span>
            </div>
          ) : sheet ? (
            <table className="w-full border-collapse font-mono text-[10.5px]">
              <thead className="sticky top-0 bg-[#15151c]">
                <tr>
                  <th className="border-b border-r border-white/10 bg-[#15151c] px-1.5 py-0.5 text-right text-[9px] font-normal text-white/40">
                    #
                  </th>
                  {sheet.activeSheet.headers.map((h, i) => (
                    <th
                      key={i}
                      className="border-b border-r border-white/10 bg-[#15151c] px-2 py-0.5 text-left font-semibold text-white/70"
                    >
                      {h || <span className="text-white/30">(col {i + 1})</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.activeSheet.data.map((row, ri) => (
                  <tr key={ri} className="odd:bg-white/[0.015]">
                    <td className="border-b border-r border-white/5 px-1.5 py-0.5 text-right text-[9px] text-white/30">
                      {ri + 1}
                    </td>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="border-b border-r border-white/5 px-2 py-0.5 text-white/80"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                {sheet.activeSheet.data.length === 0 && (
                  <tr>
                    <td
                      colSpan={sheet.activeSheet.cols + 1}
                      className="px-3 py-2 text-[11px] text-white/40"
                    >
                      このシートにはデータ行がありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-white/40">
              {selected ? "読込中..." : "ファイル未選択"}
            </div>
          )}
        </div>

        {/* Footer */}
        {sheet && (
          <div className="flex flex-shrink-0 items-center justify-between border-t border-white/10 px-3 py-1 font-mono text-[10px] text-white/40">
            <span>
              {sheet.activeSheet.rows} 行 × {sheet.activeSheet.cols} 列
              {sheet.activeSheet.truncated && ` (先頭 ${sheet.activeSheet.data.length} 行のみ表示)`}
            </span>
            <span>{formatSize(sheet.size)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
