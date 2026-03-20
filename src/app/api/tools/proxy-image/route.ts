import { NextResponse } from "next/server";

const ALLOWED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB cap — logos should never be this large

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "url param required" }, { status: 400 });
  }

  // Only allow http/https — block file:// and other schemes
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "OnboardingGuideBuilder/1.0",
        Accept: "image/*",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ error: `Remote returned ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "";
    const baseType = contentType.split(";")[0].trim().toLowerCase();

    if (!ALLOWED_CONTENT_TYPES.some((t) => baseType === t || baseType.startsWith("image/"))) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 });
    }

    const buffer = await res.arrayBuffer();

    if (buffer.byteLength > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": baseType || "image/png",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
