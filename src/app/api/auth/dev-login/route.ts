import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Dev-only login route — bypasses WorkOS for local development
// In production, this should be disabled or protected
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEV_LOGIN) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organisation: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Create session cookie
  const sessionData = {
    userId: user.id,
    email: user.email,
    name: user.name,
    organisationId: user.organisationId,
    organisationName: user.organisation.name,
    role: user.role,
  };

  const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64");

  // Set cookie on the response object (not via cookies() API)
  const response = NextResponse.json({ success: true, user: sessionData });
  response.cookies.set("wms_session", sessionToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return response;
}
