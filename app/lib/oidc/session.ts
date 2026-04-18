import { cookies } from "next/headers";
import { verifySessionJwt } from "./jwt-utils";
import { getSessionSecret } from "./lionframe-config";
import type { SessionUser } from "./types";

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("oidc_session")?.value;
  if (!token) return null;

  const session = await verifySessionJwt(token, getSessionSecret());
  if (!session) return null;

  return {
    sub: String(session.sub ?? ""),
    email: session.email ? String(session.email) : undefined,
    name: session.name ? String(session.name) : undefined,
    picture: session.picture ? String(session.picture) : undefined,
    provider: String(session.provider ?? "lion-frame"),
  };
}
