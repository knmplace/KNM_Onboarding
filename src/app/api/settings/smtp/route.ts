import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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

function getEnvPath(): string {
  return path.join(process.cwd(), ".env.local");
}

export async function GET() {
  return NextResponse.json({
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: process.env.SMTP_PORT || "465",
    smtpSecure: process.env.SMTP_SECURE ?? "true",
    smtpUsername: process.env.SMTP_USERNAME || "",
    smtpFromEmail: process.env.SMTP_FROM_EMAIL || "",
    smtpFromName: process.env.SMTP_FROM_NAME || "",
    // Never return the password — just whether it's set
    smtpPasswordSet: Boolean(process.env.SMTP_PASSWORD),
  });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const envPath = getEnvPath();
    let envContent = "";
    try {
      envContent = fs.readFileSync(envPath, "utf-8");
    } catch {
      return NextResponse.json({ error: ".env.local not found." }, { status: 500 });
    }

    const fields: Record<string, string | undefined> = {
      SMTP_HOST: body.smtpHost,
      SMTP_PORT: body.smtpPort,
      SMTP_SECURE: body.smtpSecure,
      SMTP_USERNAME: body.smtpUsername,
      SMTP_FROM_EMAIL: body.smtpFromEmail,
      SMTP_FROM_NAME: body.smtpFromName,
    };

    // Only update password if a new one is provided
    if (body.smtpPassword && body.smtpPassword.trim()) {
      fields.SMTP_PASSWORD = body.smtpPassword;
    }

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        envContent = writeEnvVar(envContent, key, String(value));
      }
    }

    try {
      fs.writeFileSync(envPath, envContent, { mode: 0o600 });
    } catch {
      return NextResponse.json({ error: "Failed to write .env.local." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
