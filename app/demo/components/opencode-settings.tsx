"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, RefreshCw, Check } from "lucide-react";

type OpenCodeConfig = {
  $schema?: string;
  provider?: Record<string, unknown>;
  model?: string;
  prompt?: string;
  instructions?: string[];
  agent?: Record<string, unknown>;
  [key: string]: unknown;
};

type PermLevel = "allow" | "ask" | "deny";
const PERM_KEYS = ["bash", "read", "edit", "glob", "grep"] as const;

function getProviderBaseURL(cfg: OpenCodeConfig): string {
  if (!cfg.provider) return "";
  const providers = cfg.provider as Record<string, Record<string, unknown>>;
  for (const p of Object.values(providers)) {
    const opts = p.options as Record<string, unknown> | undefined;
    if (opts?.baseURL) return String(opts.baseURL);
  }
  return "";
}

function setProviderBaseURL(cfg: OpenCodeConfig, url: string): OpenCodeConfig {
  if (!cfg.provider) return cfg;
  const providers = { ...cfg.provider } as Record<string, Record<string, unknown>>;
  for (const [key, p] of Object.entries(providers)) {
    const opts = (p.options ?? {}) as Record<string, unknown>;
    providers[key] = { ...p, options: { ...opts, baseURL: url } };
    break;
  }
  return { ...cfg, provider: providers };
}

function getTimeout(cfg: OpenCodeConfig): number {
  if (!cfg.provider) return 300;
  const providers = cfg.provider as Record<string, Record<string, unknown>>;
  for (const p of Object.values(providers)) {
    const opts = p.options as Record<string, unknown> | undefined;
    if (opts?.timeout) return Number(opts.timeout) / 1000;
  }
  return 300;
}

function setTimeout_(cfg: OpenCodeConfig, sec: number): OpenCodeConfig {
  if (!cfg.provider) return cfg;
  const providers = { ...cfg.provider } as Record<string, Record<string, unknown>>;
  for (const [key, p] of Object.entries(providers)) {
    const opts = (p.options ?? {}) as Record<string, unknown>;
    providers[key] = { ...p, options: { ...opts, timeout: sec * 1000 } };
    break;
  }
  return { ...cfg, provider: providers };
}

function getPerms(cfg: OpenCodeConfig): Record<string, PermLevel> {
  const agent = cfg.agent as Record<string, Record<string, unknown>> | undefined;
  const build = agent?.build;
  const perm = (build?.permission ?? {}) as Record<string, PermLevel>;
  const result: Record<string, PermLevel> = {};
  for (const k of PERM_KEYS) result[k] = perm[k] ?? "ask";
  return result;
}

function setPerms(cfg: OpenCodeConfig, perms: Record<string, PermLevel>): OpenCodeConfig {
  const agent = { ...((cfg.agent ?? {}) as Record<string, Record<string, unknown>>) };
  const build = { ...(agent.build ?? {}) };
  build.permission = perms;
  agent.build = build;
  return { ...cfg, agent };
}

export default function OpenCodeSettings({
  cwd,
  token,
}: {
  cwd: string;
  token: string;
}) {
  const [config, setConfig] = useState<OpenCodeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/opencode-config?token=${encodeURIComponent(token)}&cwd=${encodeURIComponent(cwd)}`,
      );
      const data = await res.json();
      setConfig(data.config ?? { $schema: "https://opencode.ai/config.json" });
    } catch {
      setConfig({ $schema: "https://opencode.ai/config.json" });
    }
    setLoading(false);
  }, [cwd, token]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!config) return;
    await fetch(
      `/api/opencode-config?token=${encodeURIComponent(token)}&cwd=${encodeURIComponent(cwd)}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) },
    );
    setSaved(true);
    globalThis.setTimeout(() => setSaved(false), 2000);
  };

  const update = (fn: (c: OpenCodeConfig) => OpenCodeConfig) => {
    setConfig((prev) => (prev ? fn(prev) : prev));
  };

  if (loading || !config) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-white/40">
        Loading...
      </div>
    );
  }

  const perms = getPerms(config);

  return (
    <div className="settings-scroll flex h-full flex-col overflow-y-auto bg-[#0b0b0f] px-3 py-2 text-xs text-white/80">
      <style>{`
        .settings-scroll::-webkit-scrollbar { width: 6px; }
        .settings-scroll::-webkit-scrollbar-track { background: transparent; }
        .settings-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        .settings-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/50">
          OpenCode Config
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={load}
            className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
            title="再読み込み"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={save}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${
              saved
                ? "bg-green-600 text-white"
                : "bg-sky-600 text-white hover:bg-sky-500"
            }`}
          >
            {saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {/* Model */}
      <label className="mb-2 block">
        <span className="mb-0.5 block font-mono text-[10px] text-white/50">Model</span>
        <input
          type="text"
          value={config.model ?? ""}
          onChange={(e) => update((c) => ({ ...c, model: e.target.value }))}
          placeholder="provider/model-name"
          className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-white/90 outline-none focus:border-sky-500"
        />
        <span className="mt-0.5 block text-[9px] text-white/30">
          使用するAIモデル (例: llamacpp/gemma-4-e4b-it-Q4_K_M.gguf)
        </span>
      </label>

      {/* Provider baseURL */}
      <label className="mb-2 block">
        <span className="mb-0.5 block font-mono text-[10px] text-white/50">Provider URL</span>
        <input
          type="text"
          value={getProviderBaseURL(config)}
          onChange={(e) => update((c) => setProviderBaseURL(c, e.target.value))}
          placeholder="http://127.0.0.1:8080/v1"
          className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-white/90 outline-none focus:border-sky-500"
        />
        <span className="mt-0.5 block text-[9px] text-white/30">
          AIプロバイダのAPI URL
        </span>
      </label>

      {/* Timeout */}
      <label className="mb-2 block">
        <span className="mb-0.5 block font-mono text-[10px] text-white/50">Timeout (秒)</span>
        <input
          type="number"
          value={getTimeout(config)}
          onChange={(e) => update((c) => setTimeout_(c, Number(e.target.value) || 300))}
          min={10}
          max={600}
          className="w-24 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-white/90 outline-none focus:border-sky-500"
        />
        <span className="mt-0.5 block text-[9px] text-white/30">
          ローカルモデルは長め (300秒)、クラウドは短め (60秒) を推奨
        </span>
      </label>

      {/* Prompt */}
      <label className="mb-2 block">
        <span className="mb-0.5 block font-mono text-[10px] text-white/50">System Prompt</span>
        <textarea
          value={config.prompt ?? ""}
          onChange={(e) => update((c) => ({ ...c, prompt: e.target.value || undefined }))}
          rows={3}
          placeholder="例: You are a Next.js expert..."
          className="w-full resize-y rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-white/90 outline-none focus:border-sky-500"
        />
        <span className="mt-0.5 block text-[9px] text-white/30">
          AIへの基本指示。プロジェクト固有のルールを設定
        </span>
      </label>

      {/* Instructions */}
      <label className="mb-2 block">
        <span className="mb-0.5 block font-mono text-[10px] text-white/50">Instructions</span>
        <input
          type="text"
          value={(config.instructions ?? []).join(", ")}
          onChange={(e) =>
            update((c) => ({
              ...c,
              instructions: e.target.value
                ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                : undefined,
            }))
          }
          placeholder="CLAUDE.md, AGENTS.md"
          className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-white/90 outline-none focus:border-sky-500"
        />
        <span className="mt-0.5 block text-[9px] text-white/30">
          追加で読み込む指示ファイル (カンマ区切り)
        </span>
      </label>

      {/* Permissions */}
      <div className="mb-2">
        <span className="mb-1 block font-mono text-[10px] text-white/50">Permissions</span>
        <div className="space-y-1">
          {PERM_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-10 font-mono text-[10px] text-white/60">{key}</span>
              {(["allow", "ask", "deny"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => update((c) => setPerms(c, { ...getPerms(c), [key]: level }))}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                    perms[key] === level
                      ? level === "allow"
                        ? "bg-green-600/80 text-white"
                        : level === "ask"
                          ? "bg-yellow-600/80 text-white"
                          : "bg-red-600/80 text-white"
                      : "bg-white/5 text-white/30 hover:bg-white/10"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          ))}
        </div>
        <span className="mt-1 block text-[9px] text-white/30">
          allow=自動許可 / ask=毎回確認 / deny=拒否
        </span>
      </div>
    </div>
  );
}
