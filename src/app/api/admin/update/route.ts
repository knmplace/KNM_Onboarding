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

  // Use systemd-run to launch as a fully independent system unit.
  // Pass PATH and HOME so the script has a proper environment (systemd-run
  // strips env by default, which breaks node/npm/prisma resolution).
  setTimeout(() => {
    exec(
      `systemd-run --no-block -E PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin -E HOME=/root bash ${updateScript} >> /opt/homestead/logs/update.log 2>&1`,
      (err) => {
        if (err) {
          console.error(`[admin/update] update.sh failed to launch: ${err.message}`);
        }
      }
    );
  }, 500);

  return response;
}
