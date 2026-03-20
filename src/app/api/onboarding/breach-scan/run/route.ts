import { NextResponse } from "next/server";
import { runBreachRescan } from "@/lib/breach-rescan";
import {
  getDefaultSiteRecord,
  isValidMachineKeyForSite,
  resolveSiteSelection,
} from "@/lib/site-config";

/**
 * POST /api/onboarding/breach-scan/run
 * Body:
 * {
 *   dryRun?: boolean,
 *   userId?: number,
 *   userIds?: number[],
 *   forceNotify?: boolean
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);
    const forceNotify = Boolean(body?.forceNotify);
    const siteId =
      typeof body?.siteId === "number" && Number.isInteger(body.siteId)
        ? body.siteId
        : undefined;
    const siteSlug =
      typeof body?.siteSlug === "string" && body.siteSlug.trim()
        ? body.siteSlug.trim()
        : undefined;
    const userId =
      typeof body?.userId === "number" && Number.isInteger(body.userId)
        ? body.userId
        : undefined;
    const userIds = Array.isArray(body?.userIds)
      ? body.userIds.filter((id: unknown) => Number.isInteger(id))
      : undefined;
    if (Array.isArray(body?.userIds) && userIds && userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds must contain one or more integer IDs." },
        { status: 400 }
      );
    }
    const site =
      (await resolveSiteSelection({
        siteId,
        siteSlug,
      })) || (await getDefaultSiteRecord());
    const providedKey = request.headers.get("X-Onboarding-Key");
    if (providedKey && (!site || !isValidMachineKeyForSite(site, providedKey))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runBreachRescan({
      dryRun,
      onlyUserId: userId,
      onlyUserIds: userIds,
      forceNotify,
    });

    return NextResponse.json({
      ok: true,
      dryRun,
      forceNotify,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
