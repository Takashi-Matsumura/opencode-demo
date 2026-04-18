// OIDC Discovery Document (RFC 8414)
export type OIDCDiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  scopes_supported?: string[];
  response_types_supported: string[];
  grant_types_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported: string[];
  claims_supported?: string[];
};

// Token Endpoint のレスポンス
export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
  scope?: string;
};

// デコード済み ID Token のペイロード
export type IDTokenPayload = {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  [key: string]: unknown;
};

// UserInfo Endpoint のレスポンス
export type UserInfoResponse = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  [key: string]: unknown;
};

// セッションに保存するユーザー情報
export type SessionUser = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  provider: string;
};
