import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";

async function isValidSession(token: string): Promise<boolean> {
  const secret =
    process.env.SESSION_SECRET ??
    "development-secret-change-me-in-production-xxxxxxxxxxxx";
  try {
    await jose.jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("oidc_session")?.value;
  if (token && (await isValidSession(token))) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl);
  if (token) {
    response.cookies.delete("oidc_session");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api/oidc|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
