import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";

const SETUP_TOKEN_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "setup-fallback-secret-change-this"
);

async function verifySetupSession(req: Request): Promise<boolean> {
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

export async function POST(request: Request) {
  if (process.env.SETUP_REQUIRED !== "true") {
    return NextResponse.json({ error: "Setup is already complete." }, { status: 403 });
  }

  if (!(await verifySetupSession(request))) {
    return NextResponse.json({ error: "Unauthorized. Please complete PIN verification." }, { status: 401 });
  }

  const { credentials } = await request.json().catch(() => ({ credentials: {} }));
  if (!credentials || typeof credentials !== "object") {
    return NextResponse.json({ error: "Invalid credentials payload." }, { status: 400 });
  }

  // Read current .env.local
  const envPath = path.join(process.cwd(), ".env.local");
  let envContent = "";
  try {
    envContent = fs.readFileSync(envPath, "utf-8");
  } catch {
    return NextResponse.json({ error: ".env.local not found." }, { status: 500 });
  }

  // Update or add each credential
  // Use single quotes for values containing $ (prevents dotenvx interpolation of bcrypt hashes etc.)
  // Use double quotes for all others
  for (const [key, value] of Object.entries(credentials)) {
    if (!key || typeof value !== "string") continue;
    const val = value as string;
    const linePattern = new RegExp(`^${key}=.*$`, "m");
    let newLine: string;
    if (val.includes("$")) {
      // Single-quote to prevent dotenvx from interpreting $ as variable expansion
      const escaped = val.replace(/'/g, "'\\''");
      newLine = `${key}='${escaped}'`;
    } else {
      const escaped = val.replace(/"/g, '\\"');
      newLine = `${key}="${escaped}"`;
    }
    if (linePattern.test(envContent)) {
      envContent = envContent.replace(linePattern, newLine);
    } else {
      envContent += `\n${newLine}`;
    }
  }

  // Auto-derive WordPress REST API URLs from WORDPRESS_URL if provided
  const wpUrl = (credentials["WORDPRESS_URL"] as string | undefined)?.replace(/\/$/, "");
  if (wpUrl) {
    const restPattern = /^WORDPRESS_REST_API_URL=.*$/m;
    const pgPattern = /^PROFILEGRID_API_URL=.*$/m;
    if (restPattern.test(envContent)) {
      envContent = envContent.replace(restPattern, `WORDPRESS_REST_API_URL="${wpUrl}/wp-json/wp/v2"`);
    }
    if (pgPattern.test(envContent)) {
      envContent = envContent.replace(pgPattern, `PROFILEGRID_API_URL="${wpUrl}/wp-json/profilegrid/v1"`);
    }
  }

  // Remove SETUP_REQUIRED=true so the app doesn't redirect after restart
  envContent = envContent.replace(/^SETUP_REQUIRED=.*$/m, 'SETUP_REQUIRED="false"');

  // Write back with restricted permissions
  try {
    fs.writeFileSync(envPath, envContent, { mode: 0o600 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to write .env.local." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
