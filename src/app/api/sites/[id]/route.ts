import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildSiteConfigFromInput, siteCreateSchema } from "@/lib/site-config";
import { Prisma } from "@/generated/prisma/client";

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

    // If an SMTP server from the library is selected, copy its values into the site
    let smtpOverride: Record<string, unknown> = {};
    const smtpServerId = body?.smtpServerId !== undefined
      ? (body.smtpServerId ? Number(body.smtpServerId) : null)
      : undefined;

    if (smtpServerId) {
      const smtpServer = await prisma.smtpServer.findUnique({ where: { id: smtpServerId } });
      if (smtpServer) {
        smtpOverride = {
          smtpServerId: smtpServer.id,
          smtpHost: smtpServer.host,
          smtpPort: smtpServer.port,
          smtpSecure: smtpServer.secure,
          smtpUsername: smtpServer.username,
          smtpPassword: smtpServer.password,
          smtpFromEmail: smtpServer.fromEmail,
          smtpFromName: smtpServer.fromName,
        };
      }
    } else if (smtpServerId === null) {
      smtpOverride = { smtpServerId: null };
    }

    const mergedData = {
      ...siteData,
      wordpressAppPassword:
        siteData.wordpressAppPassword ?? existing.wordpressAppPassword,
      profilegridAppPassword:
        siteData.profilegridAppPassword ?? existing.profilegridAppPassword,
      smtpHost: siteData.smtpHost ?? existing.smtpHost,
      smtpPort: siteData.smtpPort ?? existing.smtpPort,
      smtpSecure: siteData.smtpSecure ?? existing.smtpSecure,
      smtpUsername: siteData.smtpUsername ?? existing.smtpUsername,
      smtpPassword: siteData.smtpPassword ?? existing.smtpPassword,
      smtpFromEmail: siteData.smtpFromEmail ?? existing.smtpFromEmail,
      smtpFromName: siteData.smtpFromName ?? existing.smtpFromName,
      n8nWebhookAuthKey:
        existing.n8nWebhookAuthKey || siteData.n8nWebhookAuthKey,
      ...smtpOverride,
    };

    const site = await prisma.site.update({
      where: { id: siteId },
      data: mergedData,
    });

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
        createdAt: refreshedSite.createdAt,
        updatedAt: refreshedSite.updatedAt,
      },
      branding,
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

export async function DELETE(
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

    // Count remaining sites — prevent deleting the last one
    const siteCount = await prisma.site.count();
    if (siteCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only site. Add another site first." },
        { status: 400 }
      );
    }

    // Delete linked onboarding states first, then the site
    await prisma.$transaction([
      prisma.onboardingState.deleteMany({ where: { siteId } }),
      prisma.site.delete({ where: { id: siteId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
