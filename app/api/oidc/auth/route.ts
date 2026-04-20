import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { discoverProvider, buildAuthorizationUrl } from "@/app/lib/oidc/oidc-client";
import {
  generateState,
  generateNonce,
  generateCodeVerifier,
  generateCodeChallenge,
} from "@/app/lib/oidc/crypto-utils";
import { getLionFrameConfig, getRedirectUri } from "@/app/lib/oidc/lionframe-config";

export async function GET() {
  let config;
  try {
    config = getLionFrameConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : "config error";
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(message)}`,
        process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      ),
    );
  }

  const discovery = await discoverProvider(config.issuer);

  const state = generateState();
  const nonce = generateNonce();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const authUrl = buildAuthorizationUrl({
    authorizationEndpoint: discovery.authorization_endpoint,
    clientId: config.clientId,
    redirectUri: getRedirectUri(),
    scopes: config.scopes,
    state,
    nonce,
    codeChallenge,
  });

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  cookieStore.set("oidc_state", state, cookieOptions);
  cookieStore.set("oidc_nonce", nonce, cookieOptions);
  cookieStore.set("oidc_code_verifier", codeVerifier, cookieOptions);

  return NextResponse.redirect(authUrl);
}
