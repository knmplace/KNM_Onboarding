import { NextResponse } from "next/server";
import { compare } from "bcrypt";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import fs from "fs";
import path from "path";

/** Read SETUP_PIN_HASH directly from .env.local as a fallback.
 *  Next.js dotenvx may not inject values containing $ characters
 *  (bcrypt hashes start with $2b$) when they are double-quoted.
 *  Reading the file directly is the safe fallback. */
function getPinHashFromFile(): string | undefined {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/^SETUP_PIN_HASH=["']?([^"'\n]+)["']?/m);
    return match?.[1];
  } catch {
    return undefined;
  }
}

// Rate limiting: max 3 attempts per 15 minutes (in-process, resets on restart)
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 15 * 60 * 1000;
const SETUP_TOKEN_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "setup-fallback-secret-change-this"
);

function getClientKey(req: Request): string {
  return req.headers.get("x-forwarded-for") || "local";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry) return false;
  if (now > entry.resetAt) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + LOCKOUT_MS });
  } else {
    entry.count += 1;
  }
}

export async function POST(request: Request) {
  // Only available when setup is required
  if (process.env.SETUP_REQUIRED !== "true") {
    return NextResponse.json({ error: "Setup is already complete." }, { status: 403 });
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait 15 minutes." },
      { status: 429 }
    );
  }

  const { pin } = await request.json().catch(() => ({ pin: "" }));
  if (!pin || typeof pin !== "string") {
    return NextResponse.json({ error: "PIN is required." }, { status: 400 });
  }

  const storedHash = process.env.SETUP_PIN_HASH || getPinHashFromFile();
  if (!storedHash) {
    return NextResponse.json(
      { error: "Setup PIN not configured. Check SETUP_PIN_HASH in .env.local." },
      { status: 500 }
    );
  }

  const valid = await compare(pin, storedHash);
  if (!valid) {
    recordAttempt(clientKey);
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  // Issue a short-lived setup session cookie (30 min)
  const token = await new SignJWT({ setup: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30m")
    .sign(SETUP_TOKEN_SECRET);

  const cookieStore = await cookies();
  cookieStore.set("setup-session", token, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIES !== "false",
    sameSite: "strict",
    maxAge: 30 * 60,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
