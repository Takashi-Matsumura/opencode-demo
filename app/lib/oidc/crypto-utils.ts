import { createHash, randomBytes } from "crypto";

// state パラメータ生成（CSRF防止用のランダム文字列）
export function generateState(): string {
  return crypto.randomUUID();
}

// nonce パラメータ生成（リプレイ攻撃防止用）
export function generateNonce(): string {
  return crypto.randomUUID();
}

// PKCE code_verifier 生成（RFC 7636: 43〜128文字のランダム文字列）
export function generateCodeVerifier(): string {
  const bytes = randomBytes(32);
  return bytes
    .toString("base64url")
    .replace(/[^a-zA-Z0-9\-._~]/g, "")
    .slice(0, 64);
}

// PKCE code_challenge 生成（code_verifier の SHA-256 → Base64url）
export function generateCodeChallenge(verifier: string): string {
  const hash = createHash("sha256").update(verifier).digest();
  return hash.toString("base64url");
}
