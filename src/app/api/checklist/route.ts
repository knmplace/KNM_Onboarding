import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/app-settings";

/**
 * GET /api/checklist
 * Returns the getting-started checklist status for the dashboard.
 * Each item checks actual data in the DB or env vars.
 */
export async function GET() {
  try {
    const [smtpCount, wpSiteCount, userCount, abstractDbKey] = await Promise.all([
      prisma.smtpServer.count({ where: { isDefault: true } }),
      prisma.site.count({
        where: {
          wordpressUrl: { not: "PLACEHOLDER_CHANGE_ME" },
          wordpressUsername: { not: "PLACEHOLDER_CHANGE_ME" },
        },
      }),
      prisma.onboardingState.count({ where: { deletedFromWp: false } }),
      getSetting("ABSTRACT_API_KEY"),
    ]);

    const hasSmtp =
      smtpCount > 0 ||
      (!!process.env.SMTP_HOST &&
        process.env.SMTP_HOST !== "PLACEHOLDER_CHANGE_ME" &&
        !!process.env.SMTP_USERNAME &&
        process.env.SMTP_USERNAME !== "PLACEHOLDER_CHANGE_ME");

    const hasWordPress = wpSiteCount > 0;

    const envAbstractKey = process.env.ABSTRACT_API_KEY;
    const hasAbstractApi =
      !!(abstractDbKey && abstractDbKey !== "PLACEHOLDER_CHANGE_ME") ||
      !!(envAbstractKey && envAbstractKey !== "PLACEHOLDER_CHANGE_ME");

    const hasUsers = userCount > 0;

    const items = [
      {
        id: "install",
        label: "App installed and running",
        done: true,
        link: null,
        description: "ADOB is up and running.",
      },
      {
        id: "smtp",
        label: "Configure SMTP email server",
        done: hasSmtp,
        link: "/settings",
        description: "Required to send onboarding, reminder, and breach alert emails to users.",
      },
      {
        id: "wordpress",
        label: "Connect your WordPress site",
        done: hasWordPress,
        link: "/sites",
        description: "Add your WordPress + ProfileGrid credentials so users can be synced.",
      },
      {
        id: "muplugin",
        label: "Install WordPress mu-plugin",
        done: false, // Cannot auto-verify without a live WP connection — user dismisses manually
        link: "/wordpress-setup",
        description: "Required for password change tracking and login activity monitoring.",
        manualDismiss: true,
      },
      {
        id: "abstractapi",
        label: "Add Abstract API key (email validation)",
        done: hasAbstractApi,
        link: "/settings",
        description: "Optional but recommended. Validates email quality and detects breached accounts.",
        optional: true,
      },
      {
        id: "firstsync",
        label: "Sync your first users",
        done: hasUsers,
        link: null,
        description: "Run a Full Sync from the dashboard to import users from ProfileGrid.",
        action: "sync",
      },
    ];

    const allDone = items.filter((i) => !i.optional && !i.manualDismiss).every((i) => i.done);

    return NextResponse.json({ items, allDone });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
