import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route protection: send visitors without an admin session cookie to /login.
 * This is a UX guard only; every admin API endpoint independently enforces the ADMIN role.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.get("fixnow_admin_session")?.value === "1";
  if (!hasSession && request.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
