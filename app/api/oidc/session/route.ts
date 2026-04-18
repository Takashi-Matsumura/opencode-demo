import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/oidc/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true, user });
}
