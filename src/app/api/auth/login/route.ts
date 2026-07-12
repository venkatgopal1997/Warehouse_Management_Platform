import { NextResponse } from "next/server";
import { getWorkOS, getClientId } from "@/lib/auth";

export async function GET() {
  const workos = getWorkOS();
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: "authkit",
    clientId: getClientId(),
    redirectUri: process.env.WORKOS_REDIRECT_URI!,
  });

  return NextResponse.redirect(authorizationUrl);
}
