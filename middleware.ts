import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

// Paths that never require authentication
const PUBLIC_PREFIXES = [
  "/login",
  "/setup",
  "/api/setup",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/logo.jpg",
  "/logo.png",
  "/images",
  "/fonts",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Setup redirect — always takes priority ─────────────────────────────
  if (!isPublic(pathname)) {
    if (process.env.SETUP_REQUIRED === "true") {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
  }

  // ── 2. Auth guard — protect all non-public routes ─────────────────────────
  if (!isPublic(pathname)) {
    const token = request.cookies.get("onboarding-session")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    try {
      await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      // Token invalid or expired — clear cookie and redirect
      const res = NextResponse.redirect(new URL("/login", request.url));
      res.cookies.delete("onboarding-session");
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|ico|webp)).*)"],
};
