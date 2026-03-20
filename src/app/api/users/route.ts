import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getUsers } from "@/lib/profilegrid-client";
import { getWPUser } from "@/lib/wp-client";
import {
  getDefaultSiteRecord,
  getProfileGridConfigForSite,
  isValidMachineKeyForSite,
  getWpConfigForSite,
  resolveSiteSelection,
} from "@/lib/site-config";

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
 * GET /api/users - List all onboarding users from DB
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const step = searchParams.get("step");
    const breached = searchParams.get("breached");
    const search = searchParams.get("search")?.trim() || "";
    const searchScope = searchParams.get("searchScope") || "current";
    const siteIdRaw = searchParams.get("siteId");
    const siteSlug = searchParams.get("siteSlug");
    const site =
      (await resolveSiteSelection({
        siteId: siteIdRaw ? Number.parseInt(siteIdRaw, 10) : null,
        siteSlug,
      })) || (await getDefaultSiteRecord());
    const providedKey = request.headers.get("X-Onboarding-Key");
    if (providedKey && (!site || !isValidMachineKeyForSite(site, providedKey))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const where: Prisma.OnboardingStateWhereInput = {
      deletedFromWp: false,
    };
    if (searchScope !== "all" && site) {
      where.siteId = site.id;
    }
    if (step) where.onboardingStep = step;
    if (breached === "true") where.emailIsBreached = true;
    if (breached === "false") where.emailIsBreached = false;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { wordpressId: { contains: search } },
      ];
    }

    const users = await prisma.onboardingState.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        site: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ users, count: users.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/users - Sync users from ProfileGrid into the onboarding DB
 * Detects new users not yet tracked and creates/updates records for them.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const site = await resolveSiteSelection({
      siteId:
        typeof body?.siteId === "number" && Number.isInteger(body.siteId)
          ? body.siteId
          : null,
      siteSlug: typeof body?.siteSlug === "string" ? body.siteSlug : null,
    });
    if (!site) {
      return NextResponse.json({ error: "No site configured." }, { status: 500 });
    }
    const pgUsers = await getUsers(getProfileGridConfigForSite(site));
    let newCount = 0;
    let updatedCount = 0;
    const wpConfig = getWpConfigForSite(site);

    for (const pgUser of pgUsers) {
      const wpId = pgUser.id.toString();
      const wpIdNum = parseInt(wpId, 10);

      let wpUser: Awaited<ReturnType<typeof getWPUser>> = null;
      if (!Number.isNaN(wpIdNum)) {
        try {
          wpUser = await getWPUser(wpIdNum, wpConfig);
        } catch {
          wpUser = null;
        }
      }

      const preferred = resolvePreferredNames(pgUser.display_name, pgUser.email, wpUser);

      const existing = await prisma.onboardingState.findFirst({
        where: {
          wordpressId: wpId,
          ...(site ? { siteId: site.id } : { siteId: null }),
        },
      });

      const pgStatus = parseInt(pgUser.status); // "0" or "1" -> number
      const onboardingStep =
        pgStatus === 1 ? "pending_approval" : "awaiting_password_change";

      if (!existing) {
        await prisma.onboardingState.create({
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
            pendingBreachAlert: onboardingStep === "pending_approval",
          },
        });
        newCount++;
      } else {
        const updateData: Record<string, unknown> = {};

        if (existing.deletedFromWp) {
          updateData.deletedFromWp = false;
          updateData.deletedAt = null;
        }

        if (existing.rmUserStatus !== pgStatus) {
          updateData.rmUserStatus = pgStatus;

          // If user was pending and is now active, advance step
          if (
            existing.onboardingStep === "pending_approval" &&
            pgStatus === 0
          ) {
            updateData.onboardingStep = "awaiting_password_change";
          }
        }

        if ((existing.firstName ?? null) !== preferred.firstName) {
          updateData.firstName = preferred.firstName;
        }
        if ((existing.lastName ?? null) !== preferred.lastName) {
          updateData.lastName = preferred.lastName;
        }
        if (
          preferred.displayName &&
          (existing.displayName ?? null) !== preferred.displayName
        ) {
          updateData.displayName = preferred.displayName;
        }
        if (existing.email !== pgUser.email) {
          updateData.email = pgUser.email;
          updateData.emailValid = null;
          updateData.emailQualityScore = null;
          updateData.emailDeliverable = null;
          updateData.emailIsDisposable = null;
          updateData.emailIsFreeEmail = null;
          updateData.emailIsCatchAll = null;
          updateData.emailIsBreached = null;
          updateData.emailValidationRaw = Prisma.JsonNull;
          updateData.emailValidatedAt = null;
          updateData.breachAlertSentAt = null;
          updateData.breachAlertLastError = null;
          if (existing.onboardingStep === "pending_approval") {
            updateData.pendingBreachAlert = true;
          }
        }
        if ((existing.profileUrl ?? null) !== (pgUser.profile_url || null)) {
          updateData.profileUrl = pgUser.profile_url || null;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.onboardingState.update({
            where: { id: existing.id },
            data: updateData,
          });
          updatedCount++;
        }
      }
    }

    return NextResponse.json({
      synced: true,
      total: pgUsers.length,
      new: newCount,
      updated: updatedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
