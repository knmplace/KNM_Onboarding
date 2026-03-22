import { NextResponse } from "next/server";
import { exec } from "child_process";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const updateScript = "/opt/homestead-src/update.sh";

  // Respond immediately — update will run in background
  const response = NextResponse.json(
    { ok: true, message: "Update started. The app will restart automatically when complete. This takes 2–5 minutes." },
    { status: 202 }
  );

  // Delay slightly to allow response to be sent before process is interrupted
  setTimeout(() => {
    exec(`bash ${updateScript} >> /opt/homestead/logs/update.log 2>&1`, (err) => {
      if (err) {
        console.error(`[admin/update] update.sh failed: ${err.message}`);
      }
    });
  }, 500);

  return response;
}
