import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/knmplace/homestead/releases/latest";

// Cache result in-process for 1 hour to avoid hammering GitHub API
let cache: { data: VersionCheckResult; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

export type UpdateType = "patch" | "minor" | "major" | null;

export type VersionCheckResult = {
  current: string;
  latest: string | null;
  updateType: UpdateType;
  releaseNotes: string | null;
  error?: string;
};

function parseSemver(v: string): [number, number, number] | null {
  const m = v.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function getUpdateType(current: string, latest: string): UpdateType {
  const c = parseSemver(current);
  const l = parseSemver(latest);
  if (!c || !l) return null;
  if (l[0] > c[0]) return "major";
  if (l[1] > c[1]) return "minor";
  if (l[2] > c[2]) return "patch";
  return null;
}

export async function GET() {
  // Return cached result if still fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(GITHUB_RELEASES_URL, {
      headers: { "User-Agent": "homestead-app" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const result: VersionCheckResult = {
        current: APP_VERSION,
        latest: null,
        updateType: null,
        releaseNotes: null,
        error: `GitHub API returned ${res.status}`,
      };
      return NextResponse.json(result);
    }

    const json = await res.json();
    const latest: string = json.tag_name?.replace(/^v/, "") ?? null;
    const releaseNotes: string | null = json.body ?? null;
    const updateType = latest ? getUpdateType(APP_VERSION, latest) : null;

    const result: VersionCheckResult = {
      current: APP_VERSION,
      latest,
      updateType,
      releaseNotes,
    };

    cache = { data: result, fetchedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err) {
    const result: VersionCheckResult = {
      current: APP_VERSION,
      latest: null,
      updateType: null,
      releaseNotes: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
    return NextResponse.json(result);
  }
}
