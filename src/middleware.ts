import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("wms_session");
  const { pathname } = request.nextUrl;

  // Public routes that don't need auth
  const publicRoutes = ["/", "/auth/login", "/api/auth"];
  const isPublic = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route)
  );

  if (isPublic) {
    return NextResponse.next();
  }

  // Protect dashboard and API routes
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/warehouses/:path*", "/api/inventory/:path*", "/api/movements/:path*", "/api/analytics/:path*"],
};
