import { prisma } from "@/lib/db";
import { deactivateUser } from "@/lib/profilegrid-client";
import {
  discoverForgotPasswordUrl,
  getDefaultSiteRecord,
  getSiteEmailBranding,
  getMailerConfigForSite,
  getProfileGridConfigForSite,
  getWpConfigForSite,
  resolveSiteSelection,
} from "@/lib/site-config";
import {
  getLoginTimestamp,
  hasPasswordChanged,
  parseWpTimestampSafe,
} from "@/lib/wp-client";
import { sendEmail } from "@/lib/email/mailer";
import {
  accountDeactivatedEmail,
  loggedInPasswordReminderEmail,
  noLoginReminderEmail,
} from "@/lib/email/templates";

const DAY_MS = 24 * 60 * 60 * 1000;

type ReminderHistoryItem = {
  sentAt: string;
  type: "no_login" | "logged_in";
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

function getHistory(raw: unknown): ReminderHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as { sentAt?: unknown }).sentAt === "string"
    )
    .map((item) => ({
      sentAt: (item as { sentAt: string }).sentAt,
      type:
        (item as { type?: string }).type === "logged_in"
          ? "logged_in"
          : "no_login",
    }));
}

export interface ReminderRunOptions {
  dryRun?: boolean;
  asOf?: Date;
  onlyUserId?: number;
  forceSend?: boolean;
  siteId?: number;
  siteSlug?: string;
}

export interface ReminderRunResult {
  scanned: number;
  remindersSent: number;
  deactivated: number;
  completedDuringRun: number;
  skippedNotDue: number;
  errors: string[];
  actions: Array<{
    userId: number;
    wordpressId: string;
    email: string;
    action:
      | "reminder_no_login"
      | "reminder_logged_in"
      | "reminder_test_no_login"
      | "reminder_test_logged_in"
      | "deactivated"
      | "completed"
      | "skipped_not_due";
    detail: string;
  }>;
}

export async function runReminderCycle(
  options: ReminderRunOptions = {}
): Promise<ReminderRunResult> {
  const dryRun = Boolean(options.dryRun);
  const asOf = options.asOf ?? new Date();
  const forceSend = Boolean(options.forceSend);
  const site =
    (await resolveSiteSelection({
      siteId: options.siteId ?? null,
      siteSlug: options.siteSlug ?? null,
    })) || (await getDefaultSiteRecord());
  if (!site) {
    throw new Error("No site configured.");
  }

  const appUrl =
    site.onboardingAppUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:6000";
  const loginUrl = site.accountLoginUrl || process.env.ACCOUNT_LOGIN_URL || "https://your-site.com/login";
  const supportEmail = site.supportEmail || process.env.SUPPORT_EMAIL || "support@yourdomain.com";
  const emailBranding = await getSiteEmailBranding(site);
  const forgotPassword = await discoverForgotPasswordUrl(site);
  const footerImageUrl =
    emailBranding.footerImageUrl ||
    emailBranding.logoUrl ||
    site.emailFooterImageUrl ||
    process.env.EMAIL_FOOTER_IMAGE_URL ||
    undefined;
  const wpConfig = getWpConfigForSite(site);
  const profilegridConfig = getProfileGridConfigForSite(site);
  const mailerConfig = await getMailerConfigForSite(site);

  const result: ReminderRunResult = {
    scanned: 0,
    remindersSent: 0,
    deactivated: 0,
    completedDuringRun: 0,
    skippedNotDue: 0,
    errors: [],
    actions: [],
  };

  const users = await prisma.onboardingState.findMany({
    where: {
      siteId: site.id,
      onboardingStep: "awaiting_password_change",
      deletedFromWp: false,
      rmUserStatus: 0,
      ...(options.onlyUserId ? { id: options.onlyUserId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  result.scanned = users.length;

  for (const user of users) {
    try {
      const wpId = parseInt(user.wordpressId, 10);
      if (Number.isNaN(wpId)) {
        result.errors.push(`User ${user.id}: invalid wordpressId ${user.wordpressId}`);
        continue;
      }

      const activationDate = user.activatedAt ?? user.createdAt;

      const passwordChanged = await hasPasswordChanged(
        wpId,
        activationDate.toISOString(),
        wpConfig
      );
      if (passwordChanged) {
        if (!dryRun) {
          await prisma.onboardingState.update({
            where: { id: user.id },
            data: {
              onboardingStep: "completed",
              completedAt: user.completedAt ?? asOf,
            },
          });
        }
        result.completedDuringRun++;
        result.actions.push({
          userId: user.id,
          wordpressId: user.wordpressId,
          email: user.email,
          action: "completed",
          detail: "Password changed detected during reminder run.",
        });
        continue;
      }

      const loginRaw = await getLoginTimestamp(wpId, wpConfig);
      const loginDate = loginRaw ? parseWpTimestampSafe(loginRaw) : null;
      const hadLoginActivity = Boolean(user.firstLoginAt || user.lastLoginAt || loginDate);

      const firstLoginAt = user.firstLoginAt ?? (loginDate ? loginDate : null);
      const lastLoginAt =
        loginDate && (!user.lastLoginAt || loginDate > user.lastLoginAt)
          ? loginDate
          : user.lastLoginAt ?? null;

      const loginUpdateData: { firstLoginAt?: Date | null; lastLoginAt?: Date | null } =
        {};

      if (
        firstLoginAt &&
        (!user.firstLoginAt ||
          firstLoginAt.getTime() !== user.firstLoginAt.getTime())
      ) {
        loginUpdateData.firstLoginAt = firstLoginAt;
      }

      if (
        lastLoginAt &&
        (!user.lastLoginAt ||
          lastLoginAt.getTime() !== user.lastLoginAt.getTime())
      ) {
        loginUpdateData.lastLoginAt = lastLoginAt;
      }

      if (!dryRun && Object.keys(loginUpdateData).length > 0) {
        await prisma.onboardingState.update({
          where: { id: user.id },
          data: loginUpdateData,
        });
      }

      const cadenceDays = hadLoginActivity ? 14 : 5;
      const cutoffDays = hadLoginActivity ? 60 : 30;
      const ageDays = daysBetween(asOf, activationDate);

      // Ignore future-dated history entries (e.g., old simulation runs) so cadence stays correct.
      const history = getHistory(user.reminderHistory).filter((item) => {
        const sentAt = new Date(item.sentAt);
        return !Number.isNaN(sentAt.getTime()) && sentAt.getTime() <= asOf.getTime();
      });
      const firstReminderDate = history[0] ? new Date(history[0].sentAt) : null;
      const previousReminderDates = history.map((h) => new Date(h.sentAt));

      if (ageDays >= cutoffDays) {
        if (!dryRun) {
          await deactivateUser(user.wordpressId, profilegridConfig);

          const emailPayload = accountDeactivatedEmail(
            {
              displayName: user.displayName || user.email,
              email: user.email,
              activationDate,
              firstReminderDate,
              previousReminderDates,
              reminderNumber: user.reminderCount + 1,
              loginUrl,
              supportEmail,
              siteName: emailBranding.siteName,
              footerImageUrl,
              primaryColor: emailBranding.primaryColor,
              logoUrl: emailBranding.logoUrl,
              compactHeaderLogo: emailBranding.compactHeaderLogo,
              forgotPasswordUrl: forgotPassword.url || undefined,
            },
            hadLoginActivity
          );

          await sendEmail({
            to: user.email,
            subject: emailPayload.subject,
            html: emailPayload.html,
          }, mailerConfig);

          await prisma.onboardingState.update({
            where: { id: user.id },
            data: {
              rmUserStatus: 1,
              onboardingStep: "pending_approval",
              deactivatedAt: asOf,
              deactivationReason: hadLoginActivity
                ? "password_not_changed_by_day_60"
                : "no_login_or_password_change_by_day_30",
              deactivationEmailSentAt: asOf,
            },
          });
        }

        result.deactivated++;
        result.actions.push({
          userId: user.id,
          wordpressId: user.wordpressId,
          email: user.email,
          action: "deactivated",
          detail: `Deactivated at day ${ageDays} (${hadLoginActivity ? "had login activity" : "no login activity"}).`,
        });
        continue;
      }

      const lastReminderBase =
        user.lastReminderSentAt && user.lastReminderSentAt.getTime() <= asOf.getTime()
          ? user.lastReminderSentAt
          : activationDate;
      const due = forceSend || daysBetween(asOf, lastReminderBase) >= cadenceDays;

      if (!due) {
        result.skippedNotDue++;
        result.actions.push({
          userId: user.id,
          wordpressId: user.wordpressId,
          email: user.email,
          action: "skipped_not_due",
          detail: `Not due yet (cadence ${cadenceDays} days).`,
        });
        continue;
      }

      const reminderNumber = user.reminderCount + 1;
      const reminderType = hadLoginActivity ? "logged_in" : "no_login";
      const context = {
        displayName: user.displayName || user.email,
        email: user.email,
        activationDate,
        firstReminderDate,
        previousReminderDates,
        reminderNumber,
        loginUrl,
        supportEmail,
        siteName: emailBranding.siteName,
        footerImageUrl,
        primaryColor: emailBranding.primaryColor,
        logoUrl: emailBranding.logoUrl,
        compactHeaderLogo: emailBranding.compactHeaderLogo,
        forgotPasswordUrl: forgotPassword.url || undefined,
      };

      const emailPayload =
        hadLoginActivity && lastLoginAt
          ? loggedInPasswordReminderEmail(context, lastLoginAt)
          : noLoginReminderEmail(context);

      if (!dryRun) {
        await sendEmail({
          to: user.email,
          subject: emailPayload.subject,
          html: emailPayload.html,
        }, mailerConfig);

        if (!forceSend) {
          const nextHistory = [
            ...history,
            { sentAt: asOf.toISOString(), type: reminderType },
          ];

          await prisma.onboardingState.update({
            where: { id: user.id },
            data: {
              lastReminderSentAt: asOf,
              reminderCount: reminderNumber,
              reminderHistory: nextHistory as unknown as object,
              passwordReminderCount: user.passwordReminderCount + 1,
              passwordReminderSentAt: asOf,
            },
          });
        }
      }

      result.remindersSent++;
      result.actions.push({
        userId: user.id,
        wordpressId: user.wordpressId,
        email: user.email,
        action:
          forceSend
            ? reminderType === "logged_in"
              ? "reminder_test_logged_in"
              : "reminder_test_no_login"
            : reminderType === "logged_in"
              ? "reminder_logged_in"
              : "reminder_no_login",
        detail: forceSend
          ? `Manual test reminder sent (${reminderType}).`
          : `Reminder ${reminderNumber} sent on ${reminderType} cadence.`,
      });
    } catch (error) {
      result.errors.push(
        `User ${user.id} (${user.email}): ${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  return result;
}
