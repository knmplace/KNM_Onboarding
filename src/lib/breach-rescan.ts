import { prisma } from "@/lib/db";
import { extractEmailBreachSummary, validateEmail } from "@/lib/abstract-api";
import { sendEmail } from "@/lib/email/mailer";
import { periodicBreachAlertEmail } from "@/lib/email/templates";
import {
  getDefaultSiteRecord,
  getMailerConfigForSite,
  getSiteById,
  getSiteEmailBranding,
} from "@/lib/site-config";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BreachRescanRunOptions {
  dryRun?: boolean;
  onlyUserId?: number;
  onlyUserIds?: number[];
  forceNotify?: boolean;
}

export interface BreachRescanRunResult {
  scanned: number;
  validated: number;
  breached: number;
  notified: number;
  skippedCooldown: number;
  skippedNotBreached: number;
  errors: string[];
  actions: Array<{
    userId: number;
    email: string;
    action:
      | "notified"
      | "skipped_cooldown"
      | "skipped_not_breached"
      | "validation_failed";
    detail: string;
  }>;
}

export async function runBreachRescan(
  options: BreachRescanRunOptions = {}
): Promise<BreachRescanRunResult> {
  const dryRun = Boolean(options.dryRun);
  const forceNotify = Boolean(options.forceNotify);
  const cooldownDays = Number(
    process.env.BREACH_NOTIFICATION_COOLDOWN_DAYS || "30"
  );
  const now = new Date();
  const researchUrl =
    process.env.BREACH_RESEARCH_URL || "https://haveibeenpwned.com";

  const result: BreachRescanRunResult = {
    scanned: 0,
    validated: 0,
    breached: 0,
    notified: 0,
    skippedCooldown: 0,
    skippedNotBreached: 0,
    errors: [],
    actions: [],
  };

  const users = await prisma.onboardingState.findMany({
    where: {
      deletedFromWp: false,
      ...(Array.isArray(options.onlyUserIds) && options.onlyUserIds.length > 0
        ? { id: { in: options.onlyUserIds } }
        : options.onlyUserId
          ? { id: options.onlyUserId }
          : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  result.scanned = users.length;

  for (const user of users) {
    try {
      const site =
        (user.siteId ? await getSiteById(user.siteId) : null) ||
        (await getDefaultSiteRecord());
      if (!site) {
        throw new Error("No site configured for user.");
      }
      const mailerConfig = getMailerConfigForSite(site);
      const emailBranding = await getSiteEmailBranding(site);
      const validation = await validateEmail(user.email);
      result.validated++;

      if (!dryRun) {
        await prisma.onboardingState.update({
          where: { id: user.id },
          data: {
            emailValid: validation.valid,
            emailQualityScore: validation.qualityScore,
            emailDeliverable: validation.deliverable,
            emailIsDisposable: validation.isDisposable,
            emailIsFreeEmail: validation.isFreeEmail,
            emailIsCatchAll: validation.isCatchAll,
            emailIsBreached: validation.isBreached,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            emailValidationRaw: validation.raw as any,
            emailValidatedAt: now,
            breachAlertLastError: null,
          },
        });
      }

      if (!validation.isBreached) {
        if (
          forceNotify &&
          (options.onlyUserId ||
            (Array.isArray(options.onlyUserIds) &&
              options.onlyUserIds.length > 0))
        ) {
          const breachSummary = extractEmailBreachSummary(validation.raw);
          const emailPayload = periodicBreachAlertEmail(
            {
              displayName: user.displayName || user.email,
              email: user.email,
              wordpressId: user.wordpressId,
            },
            breachSummary,
            researchUrl,
            emailBranding
          );

          if (!dryRun) {
            await sendEmail({
              to: user.email,
              subject: emailPayload.subject,
              html: emailPayload.html,
            }, mailerConfig);

            await prisma.onboardingState.update({
              where: { id: user.id },
              data: {
                breachNotificationSentAt: now,
                breachNotificationCount: user.breachNotificationCount + 1,
                breachAlertLastError: null,
              },
            });
          }

          result.notified++;
          result.actions.push({
            userId: user.id,
            email: user.email,
            action: "notified",
            detail: "Forced manual notification sent for template review.",
          });
          continue;
        }

        result.skippedNotBreached++;
        result.actions.push({
          userId: user.id,
          email: user.email,
          action: "skipped_not_breached",
          detail: "Email not flagged as breached in current check.",
        });
        continue;
      }

      result.breached++;
      const lastNotified = user.breachNotificationSentAt ?? user.breachAlertSentAt;
      const cooldownMet =
        !lastNotified ||
        now.getTime() - lastNotified.getTime() >= cooldownDays * DAY_MS;

      if (!forceNotify && !cooldownMet) {
        result.skippedCooldown++;
        result.actions.push({
          userId: user.id,
          email: user.email,
          action: "skipped_cooldown",
          detail: `Notification cooldown active (${cooldownDays} days).`,
        });
        continue;
      }

      const breachSummary = extractEmailBreachSummary(validation.raw);
      const emailPayload = periodicBreachAlertEmail(
        {
          displayName: user.displayName || user.email,
          email: user.email,
          wordpressId: user.wordpressId,
        },
        breachSummary,
        researchUrl,
        emailBranding
      );

      if (!dryRun) {
        await sendEmail({
          to: user.email,
          subject: emailPayload.subject,
          html: emailPayload.html,
        }, mailerConfig);

        await prisma.onboardingState.update({
          where: { id: user.id },
          data: {
            breachNotificationSentAt: now,
            breachNotificationCount: user.breachNotificationCount + 1,
            breachAlertLastError: null,
          },
        });
      }

      result.notified++;
      result.actions.push({
        userId: user.id,
        email: user.email,
        action: "notified",
        detail: forceNotify
          ? "Notification sent with forceNotify=true."
          : "Notification sent after cooldown check.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      if (!dryRun) {
        await prisma.onboardingState.update({
          where: { id: user.id },
          data: { breachAlertLastError: message },
        });
      }
      result.errors.push(`User ${user.id} (${user.email}): ${message}`);
      result.actions.push({
        userId: user.id,
        email: user.email,
        action: "validation_failed",
        detail: message,
      });
    }
  }

  return result;
}
