import * as jose from "jose";
import type { IDTokenPayload, OIDCDiscoveryDocument } from "./types";

// JWT をデコード（署名検証なし、表示用）
export function decodeJwt(token: string): {
  header: Record<string, unknown>;
  payload: IDTokenPayload;
} {
  const header = jose.decodeProtectedHeader(token);
  const payload = jose.decodeJwt(token) as IDTokenPayload;
  return { header: { ...header }, payload };
}

// ID Token を検証（署名、iss、aud、exp、nonce をチェック）
export async function verifyIdToken(
  token: string,
  discovery: OIDCDiscoveryDocument,
  clientId: string,
  nonce?: string,
): Promise<IDTokenPayload> {
  const jwks = jose.createRemoteJWKSet(new URL(discovery.jwks_uri));

  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer: discovery.issuer,
    audience: clientId,
  });

  if (nonce && payload.nonce !== nonce) {
    throw new Error(
      `nonce mismatch: expected "${nonce}", got "${payload.nonce}"`,
    );
  }

  return payload as IDTokenPayload;
}

// セッション cookie 用の JWT を作成（対称鍵で署名）
export async function createSessionJwt(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key);
}

// セッション cookie の JWT を検証
export async function verifySessionJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, key);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}
