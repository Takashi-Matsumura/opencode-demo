"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

type SessionUser = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  provider: string;
};

type SessionResponse =
  | { authenticated: false }
  | { authenticated: true; user: SessionUser };

export default function AuthStatus() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/oidc/session")
      .then((res) => res.json() as Promise<SessionResponse>)
      .then((data) => {
        if (cancelled) return;
        if (data.authenticated) setUser(data.user);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    await fetch("/api/oidc/logout", { method: "POST" });
    window.location.href = "/login";
  };

  if (!user) return null;

  const displayName = user.name ?? user.email ?? user.sub;

  return (
    <div className="flex items-center gap-2 text-xs text-slate-600">
      <span className="max-w-[12rem] truncate" title={user.email ?? displayName}>
        {displayName}
      </span>
      <button
        type="button"
        onClick={logout}
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-slate-100"
        title="ログアウト"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>ログアウト</span>
      </button>
    </div>
  );
}
