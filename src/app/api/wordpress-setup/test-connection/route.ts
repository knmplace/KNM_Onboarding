import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST() {
  const site = await prisma.site.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });

  if (!site?.wordpressUrl || site.wordpressUrl === "PLACEHOLDER_CHANGE_ME") {
    return NextResponse.json(
      { message: "No WordPress site configured. Add your site in Sites settings first." },
      { status: 400 }
    );
  }

  const authKey = process.env.WP_WEBHOOK_AUTH_KEY;
  if (!authKey) {
    return NextResponse.json(
      { message: "WP_WEBHOOK_AUTH_KEY is not set in .env.local. Add it before testing." },
      { status: 400 }
    );
  }

  // Send a test ping to the WP webhook endpoint
  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "";
  if (!baseUrl) {
    return NextResponse.json(
      { message: "APP_URL is not configured. Cannot determine webhook endpoint URL." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${baseUrl}/api/webhook/wp-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Key": authKey,
      },
      body: JSON.stringify({
        event: "test_ping",
        wp_user_id: 0,
        email: "test@example.com",
        timestamp: new Date().toISOString(),
      }),
    });

    if (res.ok) {
      return NextResponse.json({ message: "Webhook endpoint is reachable and auth key accepted." });
    }
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { message: `Endpoint returned ${res.status}: ${data.error || "unknown error"}` },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: `Connection failed: ${message}` }, { status: 500 });
  }
}
