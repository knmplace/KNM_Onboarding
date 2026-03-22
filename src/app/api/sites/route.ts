import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildSiteConfigFromInput,
  listSites,
  siteCreateSchema,
} from "@/lib/site-config";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
  try {
    const sites = await listSites();
    const defaultSlug = process.env.DEFAULT_SITE_SLUG || "my-site";
    return NextResponse.json({
      sites: sites.map((site) => ({
        id: site.id,
        slug: site.slug,
        name: site.name,
        isActive: site.isActive,
        isDefault: site.slug === defaultSlug,
        onboardingAppUrl: site.onboardingAppUrl,
        accountLoginUrl: site.accountLoginUrl,
        wordpressUrl: site.wordpressUrl,
        wordpressRestApiUrl: site.wordpressRestApiUrl,
        profilegridApiUrl: site.profilegridApiUrl,
        emailFooterImageUrl: site.emailFooterImageUrl,
        supportEmail: site.supportEmail,
        smtpServerId: site.smtpServerId,
        smtpFromEmail: site.smtpFromEmail,
        smtpFromName: site.smtpFromName,
        userCount: site._count.onboardingStates,
        secretsConfigured: {
          wordpressAppPassword: Boolean(site.wordpressAppPassword),
          profilegridAppPassword: Boolean(site.profilegridAppPassword),
          smtpPassword: Boolean(site.smtpPassword),
          machineKey: Boolean(site.n8nWebhookAuthKey),
        },
        createdAt: site.createdAt,
        updatedAt: site.updatedAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
    const smtpServerId = body?.smtpServerId ? Number(body.smtpServerId) : null;
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
    }

    const site = await prisma.site.create({
      data: { ...siteData, ...smtpOverride },
    });

    const refreshedSite = await prisma.site.findUnique({
      where: { id: site.id },
    });
    if (!refreshedSite) {
      return NextResponse.json(
        { error: "Site was created but could not be reloaded." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        site: {
          id: refreshedSite.id,
          slug: refreshedSite.slug,
          name: refreshedSite.name,
          isActive: refreshedSite.isActive,
          onboardingAppUrl: refreshedSite.onboardingAppUrl,
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
      },
      { status: 201 }
    );
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
