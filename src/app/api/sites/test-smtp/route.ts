import { NextResponse } from "next/server";
import { verifyMailer } from "@/lib/email/mailer";

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const host = clean(body?.smtpHost);
    const username = clean(body?.smtpUsername);
    const password = clean(body?.smtpPassword);
    const fromEmail = clean(body?.smtpFromEmail) || username;
    const fromName = clean(body?.smtpFromName) || "SMTP Test";
    const secure =
      typeof body?.smtpSecure === "boolean" ? body.smtpSecure : true;
    const parsedPort = Number.parseInt(String(body?.smtpPort ?? ""), 10);
    const port = Number.isNaN(parsedPort)
      ? secure
        ? 465
        : 587
      : parsedPort;

    if (!host || !username || !password) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "SMTP host, username, and password are required before running the test.",
        },
        { status: 400 }
      );
    }

    await verifyMailer({
      host,
      port,
      secure,
      username,
      password,
      fromEmail: fromEmail || username,
      fromName,
    });

    return NextResponse.json({
      ok: true,
      result: {
        ok: true,
        detail: `Connected successfully to ${host}:${port} as ${username}.`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "SMTP connection test failed.",
      },
      { status: 500 }
    );
  }
}
