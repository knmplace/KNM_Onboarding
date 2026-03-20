import { NextRequest, NextResponse } from "next/server";
import { ONBOARDING_SESSION_COOKIE, verifySession } from "@/lib/auth";

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function hasValidMachineKey(request: NextRequest): boolean {
  const expected = process.env.N8N_WEBHOOK_AUTH_KEY;
  const provided = request.headers.get("X-Onboarding-Key");
  if (!expected || !provided) return false;
  return provided === expected;
}

function hasMachineKeyHeader(request: NextRequest): boolean {
  return Boolean(request.headers.get("X-Onboarding-Key"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  if (
    pathname.startsWith("/newsletter/intake/") ||
    pathname.startsWith("/newsletter/review/") ||
    pathname.startsWith("/newsletter/unsubscribe/") ||
    pathname.startsWith("/newsletter/resubscribe/") ||
    pathname.startsWith("/api/newsletter/public/")
  ) {
    return NextResponse.next();
  }

  // Allow n8n/machine calls to sync endpoint without browser session.
  if (
    pathname === "/api/onboarding/sync" &&
    request.method === "POST" &&
    hasMachineKeyHeader(request)
  ) {
    return NextResponse.next();
  }
  // Allow n8n/machine calls to read users when key matches.
  if (
    pathname === "/api/users" &&
    request.method === "GET" &&
    hasMachineKeyHeader(request)
  ) {
    return NextResponse.next();
  }
  if (
    pathname === "/api/onboarding/reminders/run" &&
    request.method === "POST" &&
    hasMachineKeyHeader(request)
  ) {
    return NextResponse.next();
  }
  if (
    pathname === "/api/onboarding/reminders/preview" &&
    request.method === "GET" &&
    hasMachineKeyHeader(request)
  ) {
    return NextResponse.next();
  }
  if (
    pathname === "/api/onboarding/breach-scan/run" &&
    request.method === "POST" &&
    hasMachineKeyHeader(request)
  ) {
    return NextResponse.next();
  }
  if (
    pathname === "/api/newsletter/scheduler/tick" &&
    request.method === "POST" &&
    hasValidMachineKey(request)
  ) {
    return NextResponse.next();
  }
  if (
    pathname === "/api/tools/pollinations/image" &&
    request.method === "POST" &&
    hasValidMachineKey(request)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ONBOARDING_SESSION_COOKIE)?.value;
  if (!token) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await verifySession(token);
  if (!session || !session.isAdmin) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
