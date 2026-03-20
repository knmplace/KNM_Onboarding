import { NextResponse } from "next/server";
import {
  accountDeactivatedEmail,
  loggedInPasswordReminderEmail,
  noLoginReminderEmail,
} from "@/lib/email/templates";
import {
  getDefaultSiteRecord,
  getSiteEmailBranding,
  isValidMachineKeyForSite,
  resolveSiteSelection,
} from "@/lib/site-config";

/**
 * GET /api/onboarding/reminders/preview?type=no_login|logged_in|deactivated&siteId=1
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "no_login";
    const site =
      (await resolveSiteSelection({
        siteId: searchParams.get("siteId")
          ? Number.parseInt(searchParams.get("siteId") || "", 10)
          : null,
        siteSlug: searchParams.get("siteSlug"),
      })) || (await getDefaultSiteRecord());
    const providedKey = request.headers.get("X-Onboarding-Key");
    if (providedKey && (!site || !isValidMachineKeyForSite(site, providedKey))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!site) {
      return NextResponse.json({ error: "No site configured." }, { status: 500 });
    }

    const appUrl =
      site.onboardingAppUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://your-onboarding-app.example.com";
    const loginUrl = site.accountLoginUrl || "https://your-site.com/login";
    const supportEmail = site.supportEmail || process.env.SUPPORT_EMAIL || "support@yourdomain.com";
    const emailBranding = await getSiteEmailBranding(site);
    const footerImageUrl =
      emailBranding.footerImageUrl ||
      emailBranding.logoUrl ||
      site.emailFooterImageUrl ||
      process.env.EMAIL_FOOTER_IMAGE_URL ||
      undefined;
    const activationDate = new Date("2026-03-01T12:00:00Z");
    const firstReminderDate = new Date("2026-03-06T12:00:00Z");
    const previousReminderDates = [
      new Date("2026-03-06T12:00:00Z"),
      new Date("2026-03-20T12:00:00Z"),
    ];

    const context = {
      displayName: "Sample User",
      email: "sample.user@yourdomain.com",
      activationDate,
      firstReminderDate,
      previousReminderDates,
      reminderNumber: 3,
      loginUrl,
      supportEmail,
      siteName: emailBranding.siteName,
      footerImageUrl,
      primaryColor: emailBranding.primaryColor,
      logoUrl: emailBranding.logoUrl,
      compactHeaderLogo: emailBranding.compactHeaderLogo,
    };

    let payload;
    if (type === "logged_in") {
      payload = loggedInPasswordReminderEmail(
        context,
        new Date("2026-03-25T16:30:00Z")
      );
    } else if (type === "deactivated") {
      payload = accountDeactivatedEmail(context, true);
    } else {
      payload = noLoginReminderEmail(context);
    }

    return NextResponse.json({
      type,
      subject: payload.subject,
      html: payload.html,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
