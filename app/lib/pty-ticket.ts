import * as jose from "jose";

export type PtyTicketPayload = {
  sub: string;
  cwd: string;
  sid?: string;
};

function getSecret(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ??
    "development-secret-change-me-in-production-xxxxxxxxxxxx";
  return new TextEncoder().encode(secret);
}

export async function issuePtyTicket(
  payload: PtyTicketPayload,
): Promise<string> {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(getSecret());
}

export async function verifyPtyTicket(
  token: string,
): Promise<PtyTicketPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret());
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const cwd = typeof payload.cwd === "string" ? payload.cwd : null;
    const sid = typeof payload.sid === "string" ? payload.sid : undefined;
    if (!sub || !cwd) return null;
    return { sub, cwd, sid };
  } catch {
    return null;
  }
}
