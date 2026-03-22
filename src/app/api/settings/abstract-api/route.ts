import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const hasKey =
    !!process.env.ABSTRACT_API_KEY &&
    process.env.ABSTRACT_API_KEY !== "PLACEHOLDER_CHANGE_ME";
  return NextResponse.json({ configured: hasKey });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const key = (body.apiKey ?? "").trim();

  if (!key) {
    return NextResponse.json({ error: "API key is required." }, { status: 400 });
  }

  const envPath = path.join(process.cwd(), ".env.local");
  let envContent = "";
  try {
    envContent = fs.readFileSync(envPath, "utf-8");
  } catch {
    return NextResponse.json({ error: ".env.local not found." }, { status: 500 });
  }

  if (/^ABSTRACT_API_KEY=/m.test(envContent)) {
    envContent = envContent.replace(/^ABSTRACT_API_KEY=.*$/m, `ABSTRACT_API_KEY="${key}"`);
  } else {
    envContent += `\nABSTRACT_API_KEY="${key}"\n`;
  }

  try {
    fs.writeFileSync(envPath, envContent, { mode: 0o600 });
  } catch {
    return NextResponse.json({ error: "Failed to write .env.local." }, { status: 500 });
  }

  // Update the running process env so the checklist reflects immediately
  process.env.ABSTRACT_API_KEY = key;

  return NextResponse.json({ ok: true });
}
