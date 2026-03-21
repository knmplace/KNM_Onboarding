import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { hash } from "bcrypt";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

const SETUP_TOKEN_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "setup-fallback-secret-change-this"
);

async function verifySetupSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("setup-session")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, SETUP_TOKEN_SECRET);
    return true;
  } catch {
    return false;
  }
}

/** Write or replace a key in .env.local. Single-quotes values with $ chars. */
function writeEnvVar(content: string, key: string, value: string): string {
  const linePattern = new RegExp(`^${key}=.*$`, "m");
  const escaped = value.includes("$")
    ? `${key}='${value.replace(/'/g, "'\\''")}'`
    : `${key}="${value.replace(/"/g, '\\"')}"`;
  return linePattern.test(content)
    ? content.replace(linePattern, escaped)
    : content + `\n${escaped}`;
}

export async function POST(request: Request) {
  if (process.env.SETUP_REQUIRED !== "true") {
    return NextResponse.json({ error: "Setup is already complete." }, { status: 403 });
  }

  if (!(await verifySetupSession())) {
    return NextResponse.json({ error: "Unauthorized. Please complete PIN verification." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { admin, smtp } = body as {
    admin?: { firstName?: string; lastName?: string; email?: string; password?: string };
    smtp?: Record<string, string>;
  };

  // ── Validate admin fields ────────────────────────────────────────────────
  if (!admin?.firstName || !admin?.lastName || !admin?.email || !admin?.password) {
    return NextResponse.json(
      { error: "First name, last name, email, and password are required." },
      { status: 400 }
    );
  }
  if (admin.password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  // ── Check email not already taken ────────────────────────────────────────
  const existing = await prisma.adminUser.findUnique({
    where: { email: admin.email.toLowerCase().trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An admin with that email already exists." },
      { status: 409 }
    );
  }

  // ── Create owner admin user ──────────────────────────────────────────────
  const passwordHash = await hash(admin.password, 10);
  await prisma.adminUser.create({
    data: {
      firstName: admin.firstName.trim(),
      lastName: admin.lastName.trim(),
      email: admin.email.toLowerCase().trim(),
      passwordHash,
      role: "OWNER",
    },
  });

  // ── Write SMTP settings to .env.local ────────────────────────────────────
  const envPath = path.join(process.cwd(), ".env.local");
  let envContent = "";
  try {
    envContent = fs.readFileSync(envPath, "utf-8");
  } catch {
    return NextResponse.json({ error: ".env.local not found." }, { status: 500 });
  }

  const smtpMap: Record<string, string> = {
    SMTP_HOST: smtp?.smtpHost ?? "",
    SMTP_PORT: smtp?.smtpPort ?? "465",
    SMTP_SECURE: smtp?.smtpSecure ?? "true",
    SMTP_USERNAME: smtp?.smtpUsername ?? "",
    SMTP_PASSWORD: smtp?.smtpPassword ?? "",
    SMTP_FROM_EMAIL: smtp?.smtpFromEmail ?? "",
    SMTP_FROM_NAME: smtp?.smtpFromName ?? "",
  };

  for (const [key, value] of Object.entries(smtpMap)) {
    if (value) envContent = writeEnvVar(envContent, key, value);
  }

  // Mark setup complete so middleware stops redirecting to /setup
  envContent = envContent.replace(/^SETUP_REQUIRED=.*$/m, 'SETUP_REQUIRED="false"');

  try {
    fs.writeFileSync(envPath, envContent, { mode: 0o600 });
  } catch {
    return NextResponse.json({ error: "Failed to write .env.local." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
