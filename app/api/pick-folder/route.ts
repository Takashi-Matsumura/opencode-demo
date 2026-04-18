import { execFile } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/oidc/session";
import { classifyPath } from "@/app/lib/workspace-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileP = promisify(execFile);

async function pickMac(): Promise<string> {
  const { stdout } = await execFileP(
    "osascript",
    ["-e", "POSIX path of (choose folder with prompt \"Workspace を選択\")"],
    { timeout: 5 * 60_000 },
  );
  return stdout.trim();
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (process.platform !== "darwin") {
    return NextResponse.json(
      {
        error:
          "native folder picker is currently implemented for macOS only (osascript).",
      },
      { status: 501 },
    );
  }

  let raw: string;
  try {
    raw = await pickMac();
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string };
    if (err.stderr?.includes("User canceled")) {
      return NextResponse.json({ canceled: true }, { status: 200 });
    }
    return NextResponse.json(
      { error: err.message ?? "dialog failed" },
      { status: 500 },
    );
  }

  if (!raw) {
    return NextResponse.json({ canceled: true }, { status: 200 });
  }

  const abs = path.resolve(raw);
  let real: string;
  try {
    real = realpathSync.native(abs);
    if (!statSync(real).isDirectory()) {
      return NextResponse.json(
        { error: "selected entry is not a directory" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "path unresolvable" }, { status: 404 });
  }

  const { type } = classifyPath(user.sub, real);
  return NextResponse.json({ path: real, type });
}
