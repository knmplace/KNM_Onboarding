const POLLINATIONS_IMAGE_BASE_URL =
  process.env.POLLINATIONS_IMAGE_BASE_URL || "https://gen.pollinations.ai";
const REQUIRED_MODEL = "flux";

export interface PollinationsImageInput {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
}

export interface PollinationsImageOutput {
  requestUrl: string;
  mimeType: string;
  imageBase64: string;
  modelUsed: string | null;
  authStatus: string | null;
}

function buildAuthenticatedRequestUrl(requestUrl: string, apiKey: string): string {
  const url = new URL(requestUrl);
  url.searchParams.set("key", apiKey);
  return url.toString();
}

function normalizeDimension(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function normalizeSeed(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return undefined;
  return parsed;
}

function generateRandomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

export function buildPollinationsImageUrl(input: PollinationsImageInput): string {
  const prompt = String(input.prompt || "").trim();
  if (!prompt) throw new Error("prompt is required");

  const width = normalizeDimension(input.width);
  const height = normalizeDimension(input.height);
  const providedSeed = normalizeSeed(input.seed);
  const seed = providedSeed ?? generateRandomSeed();

  const promptWithSizeContext =
    width && height
      ? `${prompt}. Composition target: ${width}x${height} pixels.`
      : prompt;

  const encodedPrompt = encodeURIComponent(promptWithSizeContext);
  const url = new URL(`${POLLINATIONS_IMAGE_BASE_URL.replace(/\/$/, "")}/image/${encodedPrompt}`);
  url.searchParams.set("model", REQUIRED_MODEL);
  url.searchParams.set("nologo", "true");
  url.searchParams.set("private", "true");
  if (width) url.searchParams.set("width", String(width));
  if (height) url.searchParams.set("height", String(height));
  url.searchParams.set("seed", String(seed));
  return url.toString();
}

export async function generatePollinationsImage(
  input: PollinationsImageInput
): Promise<PollinationsImageOutput> {
  const apiKey = (process.env.POLLINATIONS_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("POLLINATIONS_API_KEY is not configured.");
  }

  const requestUrl = buildPollinationsImageUrl(input);
  const authenticatedRequestUrl = buildAuthenticatedRequestUrl(requestUrl, apiKey);
  const response = await fetch(authenticatedRequestUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "image/*",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pollinations request failed: ${response.status} ${text.slice(0, 300)}`);
  }

  const modelUsed = response.headers.get("x-model-used");
  const authStatus = response.headers.get("x-auth-status");
  if (modelUsed && modelUsed.toLowerCase() !== REQUIRED_MODEL) {
    throw new Error(
      `Pollinations returned model "${modelUsed}" instead of required "${REQUIRED_MODEL}".`
    );
  }
  if (authStatus && authStatus.toLowerCase() !== "authenticated") {
    throw new Error(
      `Pollinations auth status is "${authStatus}". Check POLLINATIONS_API_KEY account access for "${REQUIRED_MODEL}".`
    );
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const imageBase64 = Buffer.from(await response.arrayBuffer()).toString("base64");

  return {
    requestUrl,
    mimeType: contentType,
    imageBase64,
    modelUsed,
    authStatus,
  };
}
