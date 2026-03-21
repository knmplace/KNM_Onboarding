import { NextResponse } from "next/server";
import { compare } from "bcrypt";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import fs from "fs";
import path from "path";

/** Read the bcrypt PIN hash from the dedicated .pin-hash file.
 *  deploy.sh writes the hash via `printf '%s' "$hash" > .pin-hash` so there
 *  are no quoting issues and dotenvx never touches the value.
 *  Falls back to reading SETUP_PIN_HASH from .env.local for backwards compat. */
function getPinHashFromFile(): string | undefined {
  const dir = process.env.PROJECT_DIR || process.cwd();

  // Primary: dedicated .pin-hash file (written by deploy.sh, no quoting issues)
  try {
    const pinHashPath = path.join(dir, ".pin-hash");
    const val = fs.readFileSync(pinHashPath, "utf-8").trim();
    if (val) return val;
  } catch {
    // file doesn't exist — fall through to legacy .env.local lookup
  }

  // Legacy fallback: SETUP_PIN_HASH line in .env.local (single-quoted bcrypt hash)
  try {
    const envPath = path.join(dir, ".env.local");
    const content = fs.readFileSync(envPath, "utf-8");
    const line = content.split("\n").find((l) => l.startsWith("SETUP_PIN_HASH="));
    if (!line) return undefined;
    let val = line.slice("SETUP_PIN_HASH=".length).trim();
    // Strip surrounding single or double quotes
    if ((val.startsWith("'") && val.endsWith("'")) ||
        (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    return val || undefined;
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
