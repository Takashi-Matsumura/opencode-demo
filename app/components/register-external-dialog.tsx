"use client";

export default function RegisterExternalDialog({
  path,
  onConfirm,
  onCancel,
}: {
  path: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          外部フォルダとして登録しますか？
        </h2>
        <p className="mb-3 text-xs text-slate-600">
          このフォルダは <code className="rounded bg-slate-100 px-1">~/opencode-demo-workspaces/</code> の外にあります。
        </p>
        <div className="mb-4 max-h-24 overflow-auto rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] break-all text-slate-700">
          {path}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            登録する
          </button>
        </div>
      </div>
    </div>
  );
}
