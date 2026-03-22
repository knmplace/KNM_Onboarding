import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { exec } from "child_process";

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

export async function POST(request: Request) {
  if (process.env.SETUP_REQUIRED !== "true") {
    return NextResponse.json({ error: "Setup is already complete." }, { status: 403 });
  }

  if (!(await verifySetupSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const appName = process.env.PM2_APP_NAME || "homestead";

  // Respond immediately — the restart will kill this process
  const response = NextResponse.json({ ok: true, restarting: true }, { status: 202 });

  // Delay restart slightly to allow response to be sent
  setTimeout(() => {
    exec(`pm2 restart ${appName}`, (err) => {
      if (err) {
        console.error(`[setup/restart] pm2 restart failed: ${err.message}`);
      }
    });
  }, 500);

  return response;
}
