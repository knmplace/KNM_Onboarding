import { NextResponse } from "next/server";
import { runReminderCycle } from "@/lib/onboarding-reminders";
import {
  getDefaultSiteRecord,
  isValidMachineKeyForSite,
  resolveSiteSelection,
} from "@/lib/site-config";

/**
 * POST /api/onboarding/reminders/run
 * Body:
 * {
 *   dryRun?: boolean,
 *   asOf?: string (ISO datetime),
 *   userId?: number,
 *   forceSend?: boolean,
 *   siteId?: number,
 *   siteSlug?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);
    const forceSend = Boolean(body?.forceSend);
    const userId =
      typeof body?.userId === "number" && Number.isInteger(body.userId)
        ? body.userId
        : undefined;
    const siteId =
      typeof body?.siteId === "number" && Number.isInteger(body.siteId)
        ? body.siteId
        : undefined;
    const siteSlug =
      typeof body?.siteSlug === "string" && body.siteSlug.trim()
        ? body.siteSlug.trim()
        : undefined;
    const site =
      (await resolveSiteSelection({
        siteId,
        siteSlug,
      })) || (await getDefaultSiteRecord());
    const providedKey = request.headers.get("X-Onboarding-Key");
    if (providedKey && (!site || !isValidMachineKeyForSite(site, providedKey))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const asOf =
      typeof body?.asOf === "string" && body.asOf.trim()
        ? new Date(body.asOf)
        : undefined;

    if (asOf && Number.isNaN(asOf.getTime())) {
      return NextResponse.json(
        { error: "Invalid asOf date. Use ISO format." },
        { status: 400 }
      );
    }
    if (!dryRun && asOf && asOf.getTime() > Date.now() + 60_000) {
      return NextResponse.json(
        {
          error:
            "Future asOf is only allowed with dryRun=true. Use forceSend for live manual tests.",
        },
        { status: 400 }
      );
    }

    const result = await runReminderCycle({
      dryRun,
      asOf,
      onlyUserId: userId,
      forceSend,
      siteId,
      siteSlug,
    });

    return NextResponse.json({
      ok: true,
      dryRun,
      forceSend,
      asOf: (asOf ?? new Date()).toISOString(),
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
