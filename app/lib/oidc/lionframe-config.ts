export type LionFrameConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
};

export function getLionFrameConfig(): LionFrameConfig {
  const issuer = process.env.LIONFRAME_ISSUER;
  const clientId = process.env.LIONFRAME_CLIENT_ID;
  const clientSecret = process.env.LIONFRAME_CLIENT_SECRET;

  if (!issuer) {
    throw new Error("LIONFRAME_ISSUER が設定されていません");
  }
  if (!clientId) {
    throw new Error("LIONFRAME_CLIENT_ID が設定されていません");
  }
  if (!clientSecret) {
    throw new Error("LIONFRAME_CLIENT_SECRET が設定されていません");
  }

  return {
    issuer,
    clientId,
    clientSecret,
    scopes: ["openid", "profile", "email"],
  };
}

export function getRedirectUri(): string {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${baseUrl}/api/oidc/callback`;
}

export function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ??
    "development-secret-change-me-in-production-xxxxxxxxxxxx"
  );
}
