import { NextRequest, NextResponse } from "next/server";
import { getWorkOS, getClientId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=no_code", request.url));
  }

  try {
    const workos = getWorkOS();
    const { user } = await workos.userManagement.authenticateWithCode({
      code,
      clientId: getClientId(),
    });

    // Find or match the user in our database by email
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { organisation: true },
    });

    if (!dbUser) {
      return NextResponse.redirect(
        new URL("/auth/login?error=user_not_found", request.url)
      );
    }

    // Update WorkOS user ID if not set
    if (!dbUser.workosUserId) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { workosUserId: user.id },
      });
    }

    // Create session cookie
    const sessionData = {
      userId: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      organisationId: dbUser.organisationId,
      organisationName: dbUser.organisation.name,
      role: dbUser.role,
    };

    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64");

    const cookieStore = await cookies();
    cookieStore.set("wms_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(
      new URL("/auth/login?error=auth_failed", request.url)
    );
  }
}
