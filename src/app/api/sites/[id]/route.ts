import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildSiteConfigFromInput, siteCreateSchema } from "@/lib/site-config";
import { Prisma } from "@/generated/prisma/client";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  provisionSiteWorkflows,
} = require("../../../../../scripts/lib/site-n8n-provision.js") as {
  provisionSiteWorkflows: (
    site: {
      id: number;
      slug: string;
      name: string;
      n8nWebhookAuthKey: string | null;
      n8nSyncWorkflowId: string | null;
      n8nReminderWorkflowId: string | null;
      smtpFromEmail: string | null;
    },
    options?: { activate?: boolean; appUrl?: string }
  ) => Promise<{
    ok: boolean;
    appUrl: string;
    authMode: string;
    workflows: {
      sync: { id: string; name: string; action: string; active: boolean };
      reminder: { id: string; name: string; action: string; active: boolean };
    };
    verification: Array<{
      name: string;
      ok: boolean;
      status: number;
      detail: string;
    }>;
  }>;
};

function parseSiteId(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const siteId = parseSiteId(id);
    if (!siteId) {
      return NextResponse.json({ error: "Invalid site id." }, { status: 400 });
    }

    const existing = await prisma.site.findUnique({ where: { id: siteId } });
    if (!existing) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }

    const body = await request.json();
    const smtpPortRaw =
      body?.smtpPort === "" || body?.smtpPort === undefined || body?.smtpPort === null
        ? undefined
        : Number.parseInt(String(body.smtpPort), 10);

    const parsed = siteCreateSchema.safeParse({
      name: body?.name,
      siteUrl: body?.siteUrl,
      slug: body?.slug,
      wordpressUsername: body?.wordpressUsername,
      wordpressAppPassword: body?.wordpressAppPassword,
      supportEmail: body?.supportEmail,
      accountLoginUrl: body?.accountLoginUrl,
      smtpHost: body?.smtpHost,
      smtpPort: smtpPortRaw,
      smtpSecure: body?.smtpSecure,
      smtpUsername: body?.smtpUsername,
      smtpPassword: body?.smtpPassword,
      smtpFromEmail: body?.smtpFromEmail,
      smtpFromName: body?.smtpFromName,
      emailFooterImageUrl: body?.emailFooterImageUrl,
      breachResearchUrl: body?.breachResearchUrl,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid site configuration.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { siteData, branding } = await buildSiteConfigFromInput(parsed.data);
    const site = await prisma.site.update({
      where: { id: siteId },
      data: {
        ...siteData,
        n8nWebhookAuthKey:
          existing.n8nWebhookAuthKey || siteData.n8nWebhookAuthKey,
        n8nSyncWorkflowId: existing.n8nSyncWorkflowId,
        n8nReminderWorkflowId: existing.n8nReminderWorkflowId,
      },
    });

    let provisioning = null;
    try {
      provisioning = await provisionSiteWorkflows(site, { activate: true });

      await prisma.site.update({
        where: { id: siteId },
        data: {
          n8nSyncWorkflowId: provisioning.workflows.sync.id,
          n8nReminderWorkflowId: provisioning.workflows.reminder.id,
        },
      });
    } catch (provisionError) {
      const message =
        provisionError instanceof Error
          ? provisionError.message
          : "Unknown n8n provisioning error";
      return NextResponse.json(
        {
          error: `Site was updated, but automated n8n provisioning failed: ${message}`,
          site: {
            id: site.id,
            slug: site.slug,
            name: site.name,
          },
          branding,
        },
        { status: 502 }
      );
    }

    const refreshedSite = await prisma.site.findUnique({
      where: { id: siteId },
    });
    if (!refreshedSite) {
      return NextResponse.json(
        { error: "Site was updated but could not be reloaded." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      site: {
        id: refreshedSite.id,
        slug: refreshedSite.slug,
        name: refreshedSite.name,
        isActive: refreshedSite.isActive,
        accountLoginUrl: refreshedSite.accountLoginUrl,
        wordpressUrl: refreshedSite.wordpressUrl,
        wordpressRestApiUrl: refreshedSite.wordpressRestApiUrl,
        profilegridApiUrl: refreshedSite.profilegridApiUrl,
        emailFooterImageUrl: refreshedSite.emailFooterImageUrl,
        supportEmail: refreshedSite.supportEmail,
        smtpFromEmail: refreshedSite.smtpFromEmail,
        smtpFromName: refreshedSite.smtpFromName,
        n8nSyncWorkflowId: refreshedSite.n8nSyncWorkflowId,
        n8nReminderWorkflowId: refreshedSite.n8nReminderWorkflowId,
        createdAt: refreshedSite.createdAt,
        updatedAt: refreshedSite.updatedAt,
      },
      branding,
      provisioning,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A site with that slug already exists." },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
