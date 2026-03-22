import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/app-settings";

export async function GET() {
  const dbKey = await getSetting("ABSTRACT_API_KEY");
  const envKey = process.env.ABSTRACT_API_KEY;
  const configured =
    !!(dbKey && dbKey !== "PLACEHOLDER_CHANGE_ME") ||
    !!(envKey && envKey !== "PLACEHOLDER_CHANGE_ME");
  return NextResponse.json({ configured });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const key = (body.apiKey ?? "").trim();

  if (!key) {
    return NextResponse.json({ error: "API key is required." }, { status: 400 });
  }

  await setSetting("ABSTRACT_API_KEY", key);

  return NextResponse.json({ ok: true });
}
