/**
 * Built-in job scheduler — replaces n8n for automated tasks.
 *
 * Jobs:
 *   - User sync:      every 15 minutes
 *   - Reminders:      weekly (Monday 08:00)
 *   - Breach rescan:  monthly (1st of month, 08:00)
 *
 * Started once from instrumentation/scheduler-init.ts at app boot via start.mjs.
 */

import cron from "node-cron";
import { runReminderCycle } from "@/lib/onboarding-reminders";
import { runBreachRescan } from "@/lib/breach-rescan";
import { prisma } from "@/lib/db";
import { getUsers } from "@/lib/profilegrid-client";
import { extractEmailBreachSummary, validateEmail } from "@/lib/abstract-api";
import { sendEmail } from "@/lib/email/mailer";
import { pendingBreachAlertEmail } from "@/lib/email/templates";
import {
  getDefaultSiteRecord,
  getSiteEmailBranding,
  getMailerConfigForSite,
  getProfileGridConfigForSite,
  getWpConfigForSite,
  resolveSiteSelection,
} from "@/lib/site-config";
import {
  getLoginTimestamp,
  getWPUser,
  hasPasswordChanged,
  parseWpTimestampSafe,
} from "@/lib/wp-client";
import { Prisma } from "@/generated/prisma/client";

let started = false;

function log(job: string, msg: string) {
  console.log(`[scheduler][${job}] ${new Date().toISOString()} — ${msg}`);
}

function isEmailLike(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function resolvePreferredNames(
  pgDisplayName: string | null | undefined,
  email: string,
  wpUser: Awaited<ReturnType<typeof getWPUser>>
) {
  const firstName = wpUser?.first_name?.trim() || null;
  const lastName = wpUser?.last_name?.trim() || null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const wpDisplayName = wpUser?.name?.trim() || null;
  const pgName = pgDisplayName?.trim() || null;
  const displayName =
    fullName ||
    (wpDisplayName && !isEmailLike(wpDisplayName) ? wpDisplayName : null) ||
    (pgName && !isEmailLike(pgName) ? pgName : null) ||
    pgName ||
    wpDisplayName ||
    email;
  return { firstName, lastName, displayName };
}

// ── Sync job ─────────────────────────────────────────────────────────────────

async function runSync() {
  log("sync", "Starting user sync for all sites...");
  try {
    const sites = await prisma.site.findMany({ where: { isActive: true } });
    const sitesToSync = sites.length > 0
      ? sites
      : [await getDefaultSiteRecord()].filter(Boolean);

    for (const site of sitesToSync) {
      if (!site) continue;
      try {
        const pgUsers = await getUsers(getProfileGridConfigForSite(site));
        const emailBranding = await getSiteEmailBranding(site);
        const wpConfig = getWpConfigForSite(site);
        const mailerConfig = await getMailerConfigForSite(site).catch(() => null);
        const researchUrl = site.breachResearchUrl || process.env.BREACH_RESEARCH_URL || "https://haveibeenpwned.com";
        const baseUrl = site.onboardingAppUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:6001";
        const footerImageUrl = emailBranding.footerImageUrl || emailBranding.logoUrl || site.emailFooterImageUrl || process.env.EMAIL_FOOTER_IMAGE_URL || undefined;

        const pgUserIds = new Set(pgUsers.map((u) => u.id.toString()));
        const allDbRecords = await prisma.onboardingState.findMany({
          where: { deletedFromWp: false, siteId: site.id },
          select: { id: true, wordpressId: true },
        });
        for (const dbRecord of allDbRecords) {
          if (!pgUserIds.has(dbRecord.wordpressId)) {
            await prisma.onboardingState.update({
              where: { id: dbRecord.id },
              data: { deletedFromWp: true, deletedAt: new Date() },
            });
          }
        }

        for (const pgUser of pgUsers) {
          try {
            const wpId = pgUser.id.toString();
            const wpIdNum = parseInt(wpId, 10);
            const pgStatus = parseInt(pgUser.status);
            const onboardingStep = pgStatus === 1 ? "pending_approval" : "awaiting_password_change";

            let wpUser: Awaited<ReturnType<typeof getWPUser>> = null;
            if (!Number.isNaN(wpIdNum)) {
              try { wpUser = await getWPUser(wpIdNum, wpConfig); } catch { /* continue */ }
            }

            const preferred = resolvePreferredNames(pgUser.display_name, pgUser.email, wpUser);

            let record = await prisma.onboardingState.findFirst({
              where: { wordpressId: wpId, siteId: site.id },
            });

            if (!record) {
              record = await prisma.onboardingState.create({
                data: {
                  siteId: site.id,
                  wordpressId: wpId,
                  email: pgUser.email,
                  displayName: preferred.displayName,
                  firstName: preferred.firstName,
                  lastName: preferred.lastName,
                  rmUserStatus: pgStatus,
                  profileUrl: pgUser.profile_url || null,
                  onboardingStep,
                  activatedAt: pgStatus === 0 ? new Date() : null,
                  pendingBreachAlert: onboardingStep === "pending_approval",
                },
              });
            } else {
              const updateData: Record<string, unknown> = {};
              if (record.deletedFromWp) { updateData.deletedFromWp = false; updateData.deletedAt = null; }
              if ((record.firstName ?? null) !== preferred.firstName) updateData.firstName = preferred.firstName;
              if ((record.lastName ?? null) !== preferred.lastName) updateData.lastName = preferred.lastName;
              if (preferred.displayName && (record.displayName ?? null) !== preferred.displayName) updateData.displayName = preferred.displayName;
              if (record.email !== pgUser.email) {
                updateData.email = pgUser.email;
                updateData.emailValid = null; updateData.emailQualityScore = null;
                updateData.emailDeliverable = null; updateData.emailIsDisposable = null;
                updateData.emailIsFreeEmail = null; updateData.emailIsCatchAll = null;
                updateData.emailIsBreached = null; updateData.emailValidationRaw = Prisma.JsonNull;
                updateData.emailValidatedAt = null; updateData.breachAlertSentAt = null;
                updateData.breachAlertLastError = null;
                if (record.onboardingStep === "pending_approval") updateData.pendingBreachAlert = true;
              }
              if ((record.profileUrl ?? null) !== (pgUser.profile_url || null)) updateData.profileUrl = pgUser.profile_url || null;
              if (Object.keys(updateData).length > 0) {
                record = await prisma.onboardingState.update({ where: { id: record.id }, data: updateData });
              }
            }

            let validationError: string | null = null;
            if (!record.emailValidatedAt) {
              try {
                const validation = await validateEmail(record.email);
                record = await prisma.onboardingState.update({
                  where: { id: record.id },
                  data: {
                    emailValid: validation.valid, emailQualityScore: validation.qualityScore,
                    emailDeliverable: validation.deliverable, emailIsDisposable: validation.isDisposable,
                    emailIsFreeEmail: validation.isFreeEmail, emailIsCatchAll: validation.isCatchAll,
                    emailIsBreached: validation.isBreached,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    emailValidationRaw: validation.raw as any,
                    emailValidatedAt: new Date(),
                  },
                });
              } catch (e) {
                validationError = e instanceof Error ? e.message : "unknown";
              }
            }

            if (record.rmUserStatus !== pgStatus && record.onboardingStep === "pending_approval" && pgStatus === 0) {
              record = await prisma.onboardingState.update({
                where: { id: record.id },
                data: { rmUserStatus: 0, onboardingStep: "awaiting_password_change", activatedAt: record.activatedAt ?? new Date(), pendingBreachAlert: false },
              });
            }

            if (record.pendingBreachAlert && record.onboardingStep === "pending_approval" && mailerConfig) {
              if (record.emailIsBreached === true) {
                try {
                  const breachSummary = extractEmailBreachSummary(record.emailValidationRaw);
                  const breachAlert = pendingBreachAlertEmail(
                    { displayName: record.displayName || record.email, email: record.email, wordpressId: record.wordpressId },
                    breachSummary, researchUrl, { ...emailBranding, footerImageUrl }
                  );
                  await sendEmail({ to: record.email, subject: breachAlert.subject, html: breachAlert.html }, mailerConfig);
                  await prisma.onboardingState.update({ where: { id: record.id }, data: { pendingBreachAlert: false, breachAlertSentAt: new Date(), breachAlertLastError: null } });
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "unknown";
                  await prisma.onboardingState.update({ where: { id: record.id }, data: { breachAlertLastError: msg } });
                }
              } else if (record.emailIsBreached === false) {
                await prisma.onboardingState.update({ where: { id: record.id }, data: { pendingBreachAlert: false, breachAlertLastError: null } });
              } else if (validationError) {
                await prisma.onboardingState.update({ where: { id: record.id }, data: { breachAlertLastError: validationError } });
              }
            }

            if (!Number.isNaN(wpIdNum)) {
              const loginRaw = await getLoginTimestamp(wpIdNum, wpConfig);
              if (loginRaw) {
                const loginDate = parseWpTimestampSafe(loginRaw);
                if (loginDate) {
                  const shouldUpdateFirst = !record.firstLoginAt || loginDate < record.firstLoginAt;
                  const shouldUpdateLast = !record.lastLoginAt || loginDate > record.lastLoginAt;
                  if (shouldUpdateFirst || shouldUpdateLast) {
                    await prisma.onboardingState.update({
                      where: { id: record.id },
                      data: {
                        firstLoginAt: shouldUpdateFirst ? loginDate : record.firstLoginAt,
                        lastLoginAt: shouldUpdateLast ? loginDate : record.lastLoginAt,
                      },
                    });
                  }
                }
              }
            }

            if (record.onboardingStep === "awaiting_password_change" && !Number.isNaN(wpIdNum)) {
              const changed = await hasPasswordChanged(wpIdNum, (record.activatedAt ?? record.createdAt).toISOString(), wpConfig);
              if (changed) {
                await prisma.onboardingState.update({ where: { id: record.id }, data: { onboardingStep: "completed", completedAt: new Date() } });
              }
            }
          } catch (e) {
            log("sync", `Error processing user ${pgUser.id}: ${e instanceof Error ? e.message : "unknown"}`);
          }
        }
        log("sync", `Site ${site.slug} done. ${pgUsers.length} users processed.`);
      } catch (e) {
        log("sync", `Site ${site.slug} failed: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }
  } catch (e) {
    log("sync", `Fatal error: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

// ── Reminder job ─────────────────────────────────────────────────────────────

async function runReminders() {
  log("reminders", "Starting weekly reminder cycle...");
  try {
    const sites = await prisma.site.findMany({ where: { isActive: true } });
    const sitesToRun = sites.length > 0 ? sites : [await getDefaultSiteRecord()].filter(Boolean);
    for (const site of sitesToRun) {
      if (!site) continue;
      try {
        const result = await runReminderCycle({ siteId: site.id });
        log("reminders", `Site ${site.slug}: scanned=${result.scanned} sent=${result.remindersSent} deactivated=${result.deactivated} errors=${result.errors.length}`);
      } catch (e) {
        log("reminders", `Site ${site.slug} failed: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }
  } catch (e) {
    log("reminders", `Fatal error: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

// ── Breach rescan job ─────────────────────────────────────────────────────────

async function runBreach() {
  log("breach", "Starting monthly breach rescan...");
  try {
    const result = await runBreachRescan();
    log("breach", `scanned=${result.scanned} breached=${result.breached} notified=${result.notified} errors=${result.errors.length}`);
  } catch (e) {
    log("breach", `Fatal error: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

export function startScheduler() {
  if (started) return;
  started = true;

  // Every 15 minutes
  cron.schedule("*/15 * * * *", runSync, { timezone: "UTC" });

  // Weekly — Monday at 08:00 UTC
  cron.schedule("0 8 * * 1", runReminders, { timezone: "UTC" });

  // Monthly — 1st of each month at 08:00 UTC
  cron.schedule("0 8 1 * *", runBreach, { timezone: "UTC" });

  log("init", "Scheduler started: sync=every 15min | reminders=weekly Mon 08:00 | breach=monthly 1st 08:00");
}
