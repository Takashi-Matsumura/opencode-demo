import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { resolveWithinSession } from "@/app/lib/workspace-guard";
import { getSessionUser } from "@/app/lib/oidc/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 500;
const SUPPORTED_EXT = new Set([".xlsx", ".xls", ".xlsm", ".csv"]);

type SheetPayload = {
  name: string;
  rows: number;
  cols: number;
  headers: string[];
  data: string[][];
  truncated: boolean;
};

function toRows(sheet: XLSX.WorkSheet): string[][] {
  const raw = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
    sheet,
    { header: 1, blankrows: false, defval: "", raw: false },
  );
  return raw.map((row) => row.map((v) => (v == null ? "" : String(v))));
}

function toSheetPayload(wb: XLSX.WorkBook, name: string): SheetPayload {
  const ws = wb.Sheets[name];
  const rowsAll = ws ? toRows(ws) : [];
  const totalRows = rowsAll.length;
  const sliced = rowsAll.slice(0, MAX_ROWS + 1);
  const headers = sliced[0] ?? [];
  const data = sliced.slice(1, MAX_ROWS + 1);
  const cols = Math.max(headers.length, ...data.map((r) => r.length));
  const normalizedHeaders = Array.from({ length: cols }, (_, i) => headers[i] ?? "");
  const normalizedData = data.map((r) =>
    Array.from({ length: cols }, (_, i) => r[i] ?? ""),
  );
  return {
    name,
    rows: Math.max(totalRows - 1, 0),
    cols,
    headers: normalizedHeaders,
    data: normalizedData,
    truncated: totalRows > MAX_ROWS + 1,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = request.nextUrl.searchParams.get("token");
  const raw = request.nextUrl.searchParams.get("path");
  const requestedSheet = request.nextUrl.searchParams.get("sheet");
  if (!token || !raw) {
    return NextResponse.json(
      { error: "token and path query required" },
      { status: 400 },
    );
  }

  const gate = await resolveWithinSession(token, raw, user.sub);
  if (!gate.ok) {
    const msg =
      gate.status === 401
        ? "session expired"
        : gate.status === 404
          ? "not found"
          : "outside workspace scope";
    return NextResponse.json({ error: msg }, { status: gate.status });
  }

  const safe = gate.path;
  const ext = path.extname(safe).toLowerCase();
  if (!SUPPORTED_EXT.has(ext)) {
    return NextResponse.json(
      {
        error: `unsupported extension: ${ext || "(none)"} (supported: ${[...SUPPORTED_EXT].join(", ")})`,
      },
      { status: 415 },
    );
  }

  let stat;
  try {
    stat = await fs.stat(safe);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!stat.isFile()) {
    return NextResponse.json({ error: "not a file" }, { status: 400 });
  }
  if (stat.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (${stat.size} > ${MAX_BYTES})` },
      { status: 413 },
    );
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(safe);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "read failed" },
      { status: 500 },
    );
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  } catch (e) {
    return NextResponse.json(
      { error: `failed to parse workbook: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  const sheetNames = wb.SheetNames ?? [];
  if (sheetNames.length === 0) {
    return NextResponse.json(
      { error: "workbook has no sheets" },
      { status: 400 },
    );
  }

  const activeName =
    requestedSheet && sheetNames.includes(requestedSheet)
      ? requestedSheet
      : sheetNames[0];

  return NextResponse.json({
    path: safe,
    size: stat.size,
    sheetNames,
    activeSheet: toSheetPayload(wb, activeName),
  });
}
