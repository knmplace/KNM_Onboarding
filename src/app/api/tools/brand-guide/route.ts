import { NextResponse } from "next/server";

export type BrandGuideResult = {
  siteName: string;
  logoUrl: string | null;
  iconUrl: string | null;
  primaryColor: string;
  supportEmail: string | null;
  loginUrl: string | null;
  rawUrl: string;
};

function matchMeta(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function absoluteUrl(base: string, candidate: string | null): string | null {
  if (!candidate) return null;
  try {
    return new URL(candidate, base).toString();
  } catch {
    return null;
  }
}

function extractPrimaryColor(html: string): string | null {
  // 1. theme-color meta tag
  const themeColor = matchMeta(html, [
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i,
  ]);
  if (themeColor && /^#[0-9a-f]{3,6}$/i.test(themeColor)) return themeColor;

  // 2. msapplication-TileColor
  const tileColor = matchMeta(html, [
    /<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']msapplication-TileColor["']/i,
  ]);
  if (tileColor && /^#[0-9a-f]{3,6}$/i.test(tileColor)) return tileColor;

  // 3. Scan inline CSS / style tags for common primary-ish color patterns
  //    Look for --primary, --color-primary, --brand, background on body/header
  const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? [];
  for (const block of styleBlocks) {
    const varMatch = block.match(/--(?:primary|brand|accent|main)[^:]*:\s*(#[0-9a-fA-F]{3,6})/);
    if (varMatch?.[1]) return varMatch[1];
  }

  return null;
}

function isValidHex(color: string): boolean {
  return /^#[0-9a-fA-F]{3,6}$/.test(color);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawUrl: string = body?.siteUrl ?? "";
    const providedName: string = body?.siteName ?? "";

    if (!rawUrl) {
      return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = new URL(rawUrl.trim()).toString().replace(/\/$/, "");
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let html = "";
    try {
      const res = await fetch(normalizedUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "OnboardingGuideBuilder/1.0" },
      });
      if (res.ok) html = await res.text();
    } catch {
      // Timeout or network failure — proceed with partial data
    } finally {
      clearTimeout(timeoutId);
    }

    // Site name — prefer provided name, fall back to og:site_name, then <title>
    const detectedTitle =
      matchMeta(html, [
        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
      ]) ||
      matchMeta(html, [/<title[^>]*>([^<|–-]+)/i])?.trim() ||
      null;

    const siteName = providedName.trim() || detectedTitle || new URL(normalizedUrl).hostname;

    // Site logo — priority order:
    // 1. WordPress custom-logo (actual site logo img src)
    // 2. apple-touch-icon (square, designed for small display)
    // 3. og:image only as last resort (usually a banner, not a logo)
    const wpLogoMatch = html.match(/<img[^>]+class=["'][^"']*custom-logo[^"']*["'][^>]+src=["']([^"']+)["']/i)
      || html.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*custom-logo[^"']*["']/i);

    const logoCandidate =
      wpLogoMatch?.[1] ||
      matchMeta(html, [
        /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon[^"']*["']/i,
      ]) ||
      matchMeta(html, [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      ]);

    // Favicon — best for tiny badge display
    const iconCandidate =
      matchMeta(html, [
        // Prefer larger declared icons first (32px, any size)
        /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+sizes=["']32x32["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["'][^>]+sizes=["']32x32["']/i,
        /<link[^>]+rel=["'][^"']*shortcut icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*shortcut icon[^"']*["']/i,
        /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']icon["']/i,
      ]) ?? "/favicon.ico";

    // Primary color
    const detectedColor = html ? extractPrimaryColor(html) : null;

    // Support email — look for mailto: in footer area
    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    const supportEmail = mailtoMatch?.[1] ?? null;

    const result: BrandGuideResult = {
      siteName,
      logoUrl: absoluteUrl(normalizedUrl, logoCandidate ?? null),
      iconUrl: absoluteUrl(normalizedUrl, iconCandidate),
      primaryColor: detectedColor && isValidHex(detectedColor) ? detectedColor : "#1a3a6e",
      supportEmail,
      loginUrl: `${normalizedUrl}/login`,
      rawUrl: normalizedUrl,
    };

    return NextResponse.json({ ok: true, branding: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
