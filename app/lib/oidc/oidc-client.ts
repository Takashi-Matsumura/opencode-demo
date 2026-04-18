import type {
  OIDCDiscoveryDocument,
  TokenResponse,
  UserInfoResponse,
} from "./types";

const discoveryCache = new Map<
  string,
  { doc: OIDCDiscoveryDocument; fetchedAt: number }
>();
const CACHE_TTL = 5 * 60 * 1000;

export async function discoverProvider(
  issuer: string,
): Promise<OIDCDiscoveryDocument> {
  const cached = discoveryCache.get(issuer);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.doc;
  }

  const url = issuer.endsWith("/")
    ? `${issuer}.well-known/openid-configuration`
    : `${issuer}/.well-known/openid-configuration`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Discovery fetch failed: ${res.status} ${res.statusText}`);
  }

  const doc: OIDCDiscoveryDocument = await res.json();
  discoveryCache.set(issuer, { doc, fetchedAt: Date.now() });
  return doc;
}

export function buildAuthorizationUrl(params: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = new URL(params.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scopes.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeCodeForTokens(params: {
  tokenEndpoint: string;
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(params.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${error}`);
  }

  return (await res.json()) as TokenResponse;
}

export async function fetchUserInfo(
  userInfoEndpoint: string,
  accessToken: string,
): Promise<UserInfoResponse> {
  const res = await fetch(userInfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`UserInfo fetch failed: ${res.status}`);
  }

  return (await res.json()) as UserInfoResponse;
}
