import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Setup Wizard Middleware
 *
 * If SETUP_REQUIRED=true is set in the environment (written by deploy.sh when
 * credentials were skipped), all routes are redirected to /setup until the
 * setup wizard completes and the app restarts.
 *
 * The /setup page and all /api/setup/* routes are always excluded from redirect.
 */

const EXCLUDED_PREFIXES = [
  "/setup",
  "/api/setup",
  "/_next",
  "/favicon.ico",
  "/images",
  "/fonts",
];

function isExcluded(pathname: string): boolean {
  return EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never intercept excluded paths
  if (isExcluded(pathname)) {
    return NextResponse.next();
  }

  // If setup is required, redirect everything to /setup
  if (process.env.SETUP_REQUIRED === "true") {
    const setupUrl = new URL("/setup", request.url);
    return NextResponse.redirect(setupUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
