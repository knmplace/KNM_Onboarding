import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getUsers } from "@/lib/profilegrid-client";
import { extractEmailBreachSummary, validateEmail } from "@/lib/abstract-api";
import { sendEmail } from "@/lib/email/mailer";
import { pendingBreachAlertEmail } from "@/lib/email/templates";
import {
  getDefaultSiteRecord,
  getSiteEmailBranding,
  isValidMachineKeyForSite,
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

function isEmailLike(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
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

/**
 * POST /api/onboarding/sync - Full sync: detect new users, validate emails, check statuses
 * This is the endpoint n8n calls on its 15-min schedule.
 * Optional header: X-Onboarding-Key for webhook auth
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const site =
      (await resolveSiteSelection({
        siteId:
          typeof body?.siteId === "number" && Number.isInteger(body.siteId)
            ? body.siteId
            : null,
        siteSlug: typeof body?.siteSlug === "string" ? body.siteSlug : null,
      })) || (await getDefaultSiteRecord());
    if (!site) {
      return NextResponse.json({ error: "No site configured." }, { status: 500 });
    }

    // Verify webhook auth key for external callers (n8n)
    // If the X-Onboarding-Key header is present, it must match.
    // Dashboard calls (same-origin) don't send this header, so they pass through.
    const providedKey = request.headers.get("X-Onboarding-Key");
    if (providedKey && !isValidMachineKeyForSite(site, providedKey)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pgUsers = await getUsers(getProfileGridConfigForSite(site));
    const emailBranding = await getSiteEmailBranding(site);
    const results = {
      siteId: site.id,
      siteSlug: site.slug,
      totalProfileGrid: pgUsers.length,
      newUsers: 0,
      emailsValidated: 0,
      statusChanges: 0,
      passwordsChanged: 0,
      breachAlertsSent: 0,
      breachAlertsSkippedClean: 0,
      breachAlertsPendingRetry: 0,
      breachAlertErrors: 0,
      errors: [] as string[],
    };
    const wpConfig = getWpConfigForSite(site);
    const mailerConfig = getMailerConfigForSite(site);
    const researchUrl =
      site.breachResearchUrl ||
      process.env.BREACH_RESEARCH_URL ||
      "https://haveibeenpwned.com";
    const baseUrl =
      site.onboardingAppUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:6000";
    const footerImageUrl =
      emailBranding.footerImageUrl ||
      emailBranding.logoUrl ||
      site.emailFooterImageUrl ||
      process.env.EMAIL_FOOTER_IMAGE_URL ||
      undefined;

    // Detect deleted users: find DB records not present in ProfileGrid
    const pgUserIds = new Set(pgUsers.map((u) => u.id.toString()));
    const allDbRecords = await prisma.onboardingState.findMany({
      where: {
        deletedFromWp: false,
        ...(site ? { siteId: site.id } : {}),
      },
      select: { id: true, wordpressId: true },
    });

    for (const dbRecord of allDbRecords) {
      if (!pgUserIds.has(dbRecord.wordpressId)) {
        await prisma.onboardingState.update({
          where: { id: dbRecord.id },
          data: { deletedFromWp: true, deletedAt: new Date() },
        });
        results.statusChanges++;
      }
    }

    for (const pgUser of pgUsers) {
      try {
        const wpId = pgUser.id.toString();
        const wpIdNum = parseInt(wpId, 10);
        const pgStatus = parseInt(pgUser.status); // "0" or "1" -> number
        const onboardingStep =
          pgStatus === 1 ? "pending_approval" : "awaiting_password_change";

        let wpUser: Awaited<ReturnType<typeof getWPUser>> = null;
        if (!Number.isNaN(wpIdNum)) {
          try {
            wpUser = await getWPUser(wpIdNum, wpConfig);
          } catch (e) {
            results.errors.push(
              `WP profile fetch failed for user ${wpId}: ${e instanceof Error ? e.message : "unknown"}`
            );
          }
        }

        const preferred = resolvePreferredNames(
          pgUser.display_name,
          pgUser.email,
          wpUser
        );

        let record = await prisma.onboardingState.findFirst({
          where: {
            wordpressId: wpId,
            ...(site ? { siteId: site.id } : { siteId: null }),
          },
        });

        // New user - create record
        if (!record) {
          record = await prisma.onboardingState.create({
            data: {
              ...(site ? { siteId: site.id } : {}),
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
          results.newUsers++;
        } else {
          const nameUpdateData: Record<string, unknown> = {};

          if (record.deletedFromWp) {
            nameUpdateData.deletedFromWp = false;
            nameUpdateData.deletedAt = null;
          }

          if ((record.firstName ?? null) !== preferred.firstName) {
            nameUpdateData.firstName = preferred.firstName;
          }
          if ((record.lastName ?? null) !== preferred.lastName) {
            nameUpdateData.lastName = preferred.lastName;
          }
          if (
            preferred.displayName &&
            (record.displayName ?? null) !== preferred.displayName
          ) {
            nameUpdateData.displayName = preferred.displayName;
          }
          if (record.email !== pgUser.email) {
            nameUpdateData.email = pgUser.email;
            nameUpdateData.emailValid = null;
            nameUpdateData.emailQualityScore = null;
            nameUpdateData.emailDeliverable = null;
            nameUpdateData.emailIsDisposable = null;
            nameUpdateData.emailIsFreeEmail = null;
            nameUpdateData.emailIsCatchAll = null;
            nameUpdateData.emailIsBreached = null;
            nameUpdateData.emailValidationRaw = Prisma.JsonNull;
            nameUpdateData.emailValidatedAt = null;
            nameUpdateData.breachAlertSentAt = null;
            nameUpdateData.breachAlertLastError = null;
            if (record.onboardingStep === "pending_approval") {
              nameUpdateData.pendingBreachAlert = true;
            }
          }
          if ((record.profileUrl ?? null) !== (pgUser.profile_url || null)) {
            nameUpdateData.profileUrl = pgUser.profile_url || null;
          }

          if (Object.keys(nameUpdateData).length > 0) {
            record = await prisma.onboardingState.update({
              where: { id: record.id },
              data: nameUpdateData,
            });
            if (nameUpdateData.deletedFromWp === false) {
              results.statusChanges++;
            }
          }
        }

        let validationError: string | null = null;

        // Validate email if not done yet
        if (!record.emailValidatedAt) {
          try {
            const validation = await validateEmail(record.email);
            record = await prisma.onboardingState.update({
              where: { id: record.id },
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
                emailValidatedAt: new Date(),
              },
            });
            results.emailsValidated++;
          } catch (e) {
            validationError =
              e instanceof Error ? e.message : "unknown validation error";
            results.errors.push(
              `Email validation failed for ${record.email}: ${validationError}`
            );
          }
        }

        // Check for status changes (inactive -> active)
        if (
          record.rmUserStatus !== pgStatus &&
          record.onboardingStep === "pending_approval" &&
          pgStatus === 0
        ) {
          // User was approved externally
          record = await prisma.onboardingState.update({
            where: { id: record.id },
            data: {
              rmUserStatus: 0,
              onboardingStep: "awaiting_password_change",
              activatedAt: record.activatedAt ?? new Date(),
              pendingBreachAlert: false,
            },
          });
          results.statusChanges++;
        }

        if (
          record.pendingBreachAlert &&
          record.onboardingStep === "pending_approval"
        ) {
          if (record.emailIsBreached === true) {
            try {
              const breachSummary = extractEmailBreachSummary(
                record.emailValidationRaw
              );
              const breachAlert = pendingBreachAlertEmail(
                {
                  displayName: record.displayName || record.email,
                  email: record.email,
                  wordpressId: record.wordpressId,
                },
                breachSummary,
                researchUrl,
                {
                  ...emailBranding,
                  footerImageUrl,
                }
              );

              await sendEmail({
                to: record.email,
                subject: breachAlert.subject,
                html: breachAlert.html,
              }, mailerConfig);

              await prisma.onboardingState.update({
                where: { id: record.id },
                data: {
                  pendingBreachAlert: false,
                  breachAlertSentAt: new Date(),
                  breachAlertLastError: null,
                },
              });
              results.breachAlertsSent++;
            } catch (e) {
              const message =
                e instanceof Error ? e.message : "unknown send error";
              await prisma.onboardingState.update({
                where: { id: record.id },
                data: { breachAlertLastError: message },
              });
              results.breachAlertErrors++;
              results.breachAlertsPendingRetry++;
              results.errors.push(
                `Breach alert send failed for ${record.email}: ${message}`
              );
            }
          } else if (record.emailIsBreached === false) {
            await prisma.onboardingState.update({
              where: { id: record.id },
              data: {
                pendingBreachAlert: false,
                breachAlertLastError: null,
              },
            });
            results.breachAlertsSkippedClean++;
          } else {
            const updateData: { breachAlertLastError?: string | null } = {};
            if (validationError) {
              updateData.breachAlertLastError = validationError;
            }

            if (Object.keys(updateData).length > 0) {
              await prisma.onboardingState.update({
                where: { id: record.id },
                data: updateData,
              });
            }
            results.breachAlertsPendingRetry++;
          }
        }

        // Sync login activity timestamp from WP meta.
        if (!Number.isNaN(wpIdNum)) {
          const loginTimestampRaw = await getLoginTimestamp(wpIdNum, wpConfig);
          if (loginTimestampRaw) {
            const loginDate = parseWpTimestampSafe(loginTimestampRaw);
            if (loginDate) {
              const shouldUpdateFirst =
                !record.firstLoginAt || loginDate < record.firstLoginAt;
              const shouldUpdateLast =
                !record.lastLoginAt || loginDate > record.lastLoginAt;
              if (shouldUpdateFirst || shouldUpdateLast) {
                await prisma.onboardingState.update({
                  where: { id: record.id },
                  data: {
                    firstLoginAt: shouldUpdateFirst
                      ? loginDate
                      : record.firstLoginAt,
                    lastLoginAt: shouldUpdateLast ? loginDate : record.lastLoginAt,
                  },
                });
              }
            }
          }
        }

        // Check password change for users awaiting it (via mu-plugin meta)
        if (record.onboardingStep === "awaiting_password_change" && !Number.isNaN(wpIdNum)) {
          const changed = await hasPasswordChanged(
            wpIdNum,
            (record.activatedAt ?? record.createdAt).toISOString(),
            wpConfig
          );
          if (changed) {
            await prisma.onboardingState.update({
              where: { id: record.id },
              data: {
                onboardingStep: "completed",
                completedAt: new Date(),
              },
            });
            results.passwordsChanged++;
          }
        }
      } catch (e) {
        results.errors.push(
          `Error processing user ${pgUser.id}: ${e instanceof Error ? e.message : "unknown"}`
        );
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
