import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generatePollinationsImage } from "@/lib/tools/pollinations";
import { checkPollinationsRateLimit } from "@/lib/tools/pollinationsRateLimit";

function hasValidMachineKey(request: Request): boolean {
  const expected = process.env.N8N_WEBHOOK_AUTH_KEY;
  const provided = request.headers.get("X-Onboarding-Key");
  if (!expected || !provided) return false;
  return expected === provided;
}

async function authorize(request: Request) {
  if (hasValidMachineKey(request)) return;
  const session = await getSession();
  if (!session?.isAdmin) throw new Error("Unauthorized");
}

export async function POST(request: Request) {
  try {
    await authorize(request);
    const gate = checkPollinationsRateLimit();
    if (!gate.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded for Pollinations image requests.",
          limit: "3 requests per 15 seconds",
          retryAfterSeconds: gate.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(gate.retryAfterSeconds),
          },
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const prompt = typeof body?.prompt === "string" ? body.prompt : "";
    const width =
      body?.width === undefined || body?.width === null ? undefined : Number(body.width);
    const height =
      body?.height === undefined || body?.height === null ? undefined : Number(body.height);
    const seed = body?.seed === undefined || body?.seed === null ? undefined : Number(body.seed);
    const responseFormat =
      body?.responseFormat === "data_url" || body?.responseFormat === "url"
        ? body.responseFormat
        : "base64";

    const image = await generatePollinationsImage({ prompt, width, height, seed });
    if (responseFormat === "url") {
      return NextResponse.json({
        ok: true,
        requestUrl: image.requestUrl,
        modelUsed: image.modelUsed,
        authStatus: image.authStatus,
      });
    }

    if (responseFormat === "data_url") {
      return NextResponse.json({
        ok: true,
        requestUrl: image.requestUrl,
        modelUsed: image.modelUsed,
        authStatus: image.authStatus,
        mimeType: image.mimeType,
        imageDataUrl: `data:${image.mimeType};base64,${image.imageBase64}`,
      });
    }

    return NextResponse.json({
      ok: true,
      requestUrl: image.requestUrl,
      modelUsed: image.modelUsed,
      authStatus: image.authStatus,
      mimeType: image.mimeType,
      imageBase64: image.imageBase64,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed" },
      { status: 500 }
    );
  }
}
