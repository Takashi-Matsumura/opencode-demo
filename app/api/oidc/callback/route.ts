import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { discoverProvider, exchangeCodeForTokens } from "@/app/lib/oidc/oidc-client";
import { verifyIdToken, createSessionJwt } from "@/app/lib/oidc/jwt-utils";
import {
  getLionFrameConfig,
  getRedirectUri,
  getSessionSecret,
} from "@/app/lib/oidc/lionframe-config";

function loginRedirect(request: NextRequest, error: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(error)}`, request.url),
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const description = searchParams.get("error_description") ?? error;
    return loginRedirect(request, description);
  }

  if (!code || !state) {
    return loginRedirect(request, "Missing code or state");
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("oidc_state")?.value;
  const savedNonce = cookieStore.get("oidc_nonce")?.value;
  const codeVerifier = cookieStore.get("oidc_code_verifier")?.value;

  if (state !== savedState) {
    return loginRedirect(request, "State mismatch");
  }
  if (!codeVerifier) {
    return loginRedirect(request, "Missing code_verifier");
  }

  try {
    const config = getLionFrameConfig();
    const discovery = await discoverProvider(config.issuer);

    const tokenResponse = await exchangeCodeForTokens({
      tokenEndpoint: discovery.token_endpoint,
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: getRedirectUri(),
      codeVerifier,
    });

    const idTokenPayload = await verifyIdToken(
      tokenResponse.id_token,
      discovery,
      config.clientId,
      savedNonce,
    );

    const sessionData = {
      sub: idTokenPayload.sub,
      email: idTokenPayload.email,
      name: idTokenPayload.name,
      picture: idTokenPayload.picture,
      provider: "lion-frame",
    };

    const sessionJwt = await createSessionJwt(sessionData, getSessionSecret());

    cookieStore.delete("oidc_state");
    cookieStore.delete("oidc_nonce");
    cookieStore.delete("oidc_code_verifier");

    cookieStore.set("oidc_session", sessionJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60,
      path: "/",
    });

    return NextResponse.redirect(new URL("/", request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return loginRedirect(request, message);
  }
}
