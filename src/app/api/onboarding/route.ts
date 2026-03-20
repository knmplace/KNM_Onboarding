import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { activateUser, deactivateUser, deleteUser } from "@/lib/profilegrid-client";
import { deleteWPUser, hasPasswordChanged } from "@/lib/wp-client";
import { sendEmail } from "@/lib/email/mailer";
import { passwordReminderEmail } from "@/lib/email/templates";
import {
  getDefaultSiteRecord,
  getSiteEmailBranding,
  getMailerConfigForSite,
  getProfileGridConfigForSite,
  getSiteById,
  getWpConfigForSite,
} from "@/lib/site-config";

/**
 * POST /api/onboarding - Advance a user's onboarding step
 * Body: { userId: number, action: "approve" | "check_password" | "complete" | "disable" | "delete_remote_and_archive" }
 */
export async function POST(request: Request) {
  try {
    const { userId, action } = await request.json();

    if (!userId || !action) {
      return NextResponse.json(
        { error: "userId and action are required" },
        { status: 400 }
      );
    }

    const user = await prisma.onboardingState.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const site =
      (user.siteId ? await getSiteById(user.siteId) : null) ||
      (await getDefaultSiteRecord());
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 500 });
    }

    const profileGridConfig = getProfileGridConfigForSite(site);
    const wpConfig = getWpConfigForSite(site);
    const mailerConfig = getMailerConfigForSite(site);
    const emailBranding = await getSiteEmailBranding(site);

    switch (action) {
      case "approve": {
        // Activate user in ProfileGrid and advance step
        await activateUser(user.wordpressId, profileGridConfig);

        const updated = await prisma.onboardingState.update({
          where: { id: userId },
          data: {
            onboardingStep: "awaiting_password_change",
            rmUserStatus: 0,
            activatedAt: user.activatedAt ?? new Date(),
          },
        });

        // Send account-activated onboarding email with direct login URL.
        const loginUrl =
          site.accountLoginUrl ||
          process.env.ACCOUNT_LOGIN_URL ||
          "https://your-site.com/login";
        const activationEmail = passwordReminderEmail(
          {
            displayName: updated.displayName || updated.email,
            email: updated.email,
            wordpressId: updated.wordpressId,
          },
          updated.emailIsBreached === true,
          0,
          loginUrl,
          emailBranding
        );

        await sendEmail({
          to: updated.email,
          subject: activationEmail.subject,
          html: activationEmail.html,
        }, mailerConfig);

        return NextResponse.json({ user: updated, action: "approved" });
      }

      case "check_password": {
        // Check if user has changed their password via mu-plugin meta
        const changed = await hasPasswordChanged(
          parseInt(user.wordpressId),
          user.createdAt.toISOString(),
          wpConfig
        );

        if (changed) {
          const updated = await prisma.onboardingState.update({
            where: { id: userId },
            data: {
              onboardingStep: "completed",
              completedAt: new Date(),
            },
          });
          return NextResponse.json({
            user: updated,
            action: "password_changed",
            completed: true,
          });
        }

        return NextResponse.json({
          user,
          action: "password_not_changed",
          completed: false,
        });
      }

      case "complete": {
        // Manually mark as completed
        const updated = await prisma.onboardingState.update({
          where: { id: userId },
          data: {
            onboardingStep: "completed",
            completedAt: new Date(),
          },
        });
        return NextResponse.json({ user: updated, action: "completed" });
      }

      case "disable": {
        await deactivateUser(user.wordpressId, profileGridConfig);

        const updated = await prisma.onboardingState.update({
          where: { id: userId },
          data: {
            rmUserStatus: 1,
            onboardingStep: "pending_approval",
          },
        });

        return NextResponse.json({ user: updated, action: "disabled" });
      }

      case "delete_remote_and_archive": {
        // Delete remotely. Try ProfileGrid first (token-auth integration API),
        // then fall back to WP REST delete for installations without delete actions.
        const wpId = parseInt(user.wordpressId, 10);
        if (Number.isNaN(wpId)) {
          return NextResponse.json(
            { error: `Invalid WordPress ID: ${user.wordpressId}` },
            { status: 400 }
          );
        }

        let remoteAlreadyMissing = false;
        let profileGridDeleteError: string | null = null;

        try {
          await deleteUser(user.wordpressId, profileGridConfig);
        } catch (error) {
          profileGridDeleteError =
            error instanceof Error ? error.message : String(error);
          const wpDelete = await deleteWPUser(wpId, wpConfig);
          remoteAlreadyMissing = wpDelete.alreadyMissing;
        }

        const updated = await prisma.onboardingState.update({
          where: { id: userId },
          data: {
            rmUserStatus: 1,
            deletedFromWp: true,
            deletedAt: new Date(),
          },
        });

        return NextResponse.json({
          user: updated,
          action: remoteAlreadyMissing
            ? "already_deleted_remote_archived"
            : "deleted_remote_and_archived",
          profileGridDeleteError,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/onboarding - Manual override of onboarding step
 * Body: { userId: number, step: string }
 */
export async function PATCH(request: Request) {
  try {
    const { userId, step } = await request.json();

    const validSteps = [
      "pending_approval",
      "awaiting_password_change",
      "completed",
    ];
    if (!userId || !step || !validSteps.includes(step)) {
      return NextResponse.json(
        { error: `userId and step (${validSteps.join(", ")}) are required` },
        { status: 400 }
      );
    }

    const updated = await prisma.onboardingState.update({
      where: { id: userId },
      data: {
        onboardingStep: step,
        completedAt: step === "completed" ? new Date() : null,
      },
    });

    return NextResponse.json({ user: updated, overridden: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
