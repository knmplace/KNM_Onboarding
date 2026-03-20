import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getMailerConfigForSite,
  getProfileGridConfigForSite,
  getWpConfigForSite,
} from "@/lib/site-config";
import { getUsers } from "@/lib/profilegrid-client";
import { checkOnboardingTrackerSupport, getWPUsers } from "@/lib/wp-client";
import { verifyMailer } from "@/lib/email/mailer";

function parseSiteId(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

type ConnectionResult = {
  ok: boolean;
  detail: string;
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const siteId = parseSiteId(id);
    if (!siteId) {
      return NextResponse.json({ error: "Invalid site id." }, { status: 400 });
    }

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }

    const results: Record<string, ConnectionResult> = {};

    try {
      const wpConfig = getWpConfigForSite(site);
      const wpUsers = await getWPUsers(1, 1, wpConfig);
      results.wordpress = {
        ok: true,
        detail: `Connected successfully. Retrieved ${wpUsers.length} user record(s).`,
      };

      const trackerCheck = await checkOnboardingTrackerSupport(wpConfig);
      results.tracker = trackerCheck;
    } catch (error) {
      results.wordpress = {
        ok: false,
        detail: error instanceof Error ? error.message : "WordPress test failed.",
      };
      results.tracker = {
        ok: false,
        detail:
          "Tracker check was skipped because WordPress connectivity did not succeed.",
      };
    }

    try {
      const profileGridConfig = getProfileGridConfigForSite(site);
      const pgUsers = await getUsers(profileGridConfig);
      results.profilegrid = {
        ok: true,
        detail: `Connected successfully. Retrieved ${pgUsers.length} user record(s).`,
      };
    } catch (error) {
      results.profilegrid = {
        ok: false,
        detail: error instanceof Error ? error.message : "ProfileGrid test failed.",
      };
    }

    try {
      const mailerConfig = getMailerConfigForSite(site);
      await verifyMailer(mailerConfig);
      results.smtp = {
        ok: true,
        detail: `Connected successfully as ${mailerConfig.fromEmail}.`,
      };
    } catch (error) {
      results.smtp = {
        ok: false,
        detail: error instanceof Error ? error.message : "SMTP test failed.",
      };
    }

    const ok = Object.values(results).every((result) => result.ok);

    return NextResponse.json({
      ok,
      site: { id: site.id, slug: site.slug, name: site.name },
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
