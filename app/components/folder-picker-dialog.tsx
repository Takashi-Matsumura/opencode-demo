"use client";

import { useCallback, useEffect, useState } from "react";
import { Folder, ArrowUp, Check, X } from "lucide-react";

type BrowseEntry = { name: string; path: string };

type BrowseResponse = {
  home: string;
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
};

async function fetchBrowse(path?: string): Promise<BrowseResponse> {
  const url = path
    ? `/api/browse?path=${encodeURIComponent(path)}`
    : "/api/browse";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as BrowseResponse;
}

export default function FolderPickerDialog({
  onSelect,
  onCancel,
}: {
  onSelect: (path: string) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchBrowse(path);
      setData(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="flex h-[28rem] w-full max-w-lg flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
          <h2 className="text-sm font-semibold text-slate-900">
            フォルダを選択
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            title="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <button
            type="button"
            disabled={!data?.parent || loading}
            onClick={() => data?.parent && void load(data.parent)}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-300 bg-white p-1 text-slate-700 hover:bg-slate-50 disabled:opacity-30"
            title="上のフォルダ"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <div
            className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-600"
            title={data?.path ?? ""}
          >
            {data?.path ?? "…"}
          </div>
        </div>

        {error && (
          <div className="border-b border-rose-200 bg-rose-50 px-3 py-1 font-mono text-[11px] text-rose-700">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {loading && !data ? (
            <div className="px-3 py-2 font-mono text-xs text-slate-400">
              loading…
            </div>
          ) : data?.entries.length === 0 ? (
            <div className="px-3 py-2 font-mono text-xs text-slate-400">
              (サブフォルダなし)
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data?.entries.map((e) => (
                <li key={e.path}>
                  <button
                    type="button"
                    onClick={() => void load(e.path)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
                  >
                    <Folder className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="truncate font-mono text-xs text-slate-800">
                      {e.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-3 py-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={!data}
            onClick={() => data && onSelect(data.path)}
            className="inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
            このフォルダを選択
          </button>
        </div>
      </div>
    </div>
  );
}
