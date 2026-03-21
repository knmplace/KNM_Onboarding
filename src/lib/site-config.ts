import { prisma } from "@/lib/db";
import type { MailerConfig } from "@/lib/email/mailer";
import type { ProfileGridClientConfig } from "@/lib/profilegrid-client";
import type { WPClientConfig } from "@/lib/wp-client";
import { z } from "zod";

export const DEFAULT_SITE_SLUG = process.env.DEFAULT_SITE_SLUG || "my-site";

export type SiteConfigInput = {
  slug: string;
  name: string;
  onboardingAppUrl: string | null;
  accountLoginUrl: string | null;
  wordpressUrl: string | null;
  wordpressRestApiUrl: string | null;
  wordpressUsername: string | null;
  wordpressAppPassword: string | null;
  profilegridApiUrl: string | null;
  profilegridUsername: string | null;
  profilegridAppPassword: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUsername: string | null;
  smtpPassword: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  supportEmail: string | null;
  emailFooterImageUrl: string | null;
  n8nWebhookAuthKey: string | null;
  n8nSyncWorkflowId: string | null;
  n8nReminderWorkflowId: string | null;
  breachResearchUrl: string | null;
};

export type SiteBrandingDiscovery = {
  detectedName: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
};

export type SiteEmailBranding = {
  siteSlug?: string;
  siteName: string;
  supportEmail: string;
  footerImageUrl?: string;
  logoUrl?: string;
  iconUrl?: string;
  primaryColor: string;
  compactHeaderLogo?: boolean;
};

export type ForgotPasswordDiscovery = {
  url: string | null;
  source:
    | "login_link"
    | "login_text_link"
    | "wp_default"
    | "woocommerce_default"
    | "none";
};

export const siteCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  siteUrl: z.string().trim().url(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug must use lowercase letters, numbers, and hyphens only.")
    .min(2)
    .max(50)
    .optional()
    .or(z.literal("")),
  wordpressUsername: z.string().trim().max(100).optional().or(z.literal("")),
  wordpressAppPassword: z.string().trim().max(200).optional().or(z.literal("")),
  supportEmail: z.string().trim().email().optional().or(z.literal("")),
  accountLoginUrl: z.string().trim().url().optional().or(z.literal("")),
  smtpHost: z.string().trim().max(200).optional().or(z.literal("")),
  smtpPort: z.union([z.number().int().min(1).max(65535), z.nan()]).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUsername: z.string().trim().max(200).optional().or(z.literal("")),
  smtpPassword: z.string().trim().max(200).optional().or(z.literal("")),
  smtpFromEmail: z.string().trim().email().optional().or(z.literal("")),
  smtpFromName: z.string().trim().max(200).optional().or(z.literal("")),
  emailFooterImageUrl: z.string().trim().url().optional().or(z.literal("")),
  breachResearchUrl: z.string().trim().url().optional().or(z.literal("")),
});

export type SiteCreateInput = z.infer<typeof siteCreateSchema>;

function parseOptionalInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalBool(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function clean(value: string | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

function generateMachineKey(): string {
  return `site_${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}${Date.now().toString(36)}`;
}

export function cleanOptionalString(value: string | null | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

export function normalizeUrl(value: string): string {
  const url = new URL(value.trim());
  return url.toString().replace(/\/$/, "");
}

export function slugifySiteName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function maybeUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return normalizeUrl(value);
}

function maybeNumber(value: number | undefined): number | null {
  if (value === undefined || Number.isNaN(value)) return null;
  return value;
}

function absoluteUrl(base: string, candidate: string | null): string | null {
  if (!candidate) return null;
  try {
    return new URL(candidate, base).toString();
  } catch {
    return null;
  }
}

function matchMeta(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function extractPrimaryColor(html: string): string | null {
  const themeColor = matchMeta(html, [
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i,
  ]);
  if (themeColor && /^#[0-9a-f]{3,6}$/i.test(themeColor)) return themeColor;

  const tileColor = matchMeta(html, [
    /<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']msapplication-TileColor["']/i,
  ]);
  if (tileColor && /^#[0-9a-f]{3,6}$/i.test(tileColor)) return tileColor;

  const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? [];
  for (const block of styleBlocks) {
    const varMatch = block.match(
      /--(?:primary|brand|accent|main)[^:]*:\s*(#[0-9a-fA-F]{3,6})/
    );
    if (varMatch?.[1]) return varMatch[1];
  }

  return null;
}

function findForgotPasswordUrl(
  html: string,
  baseUrl: string
): ForgotPasswordDiscovery {
  const hrefPatterns = [
    /<a[^>]+href=["']([^"']*(?:lostpassword|forgot-password|forgot_password|reset-password|password-reset)[^"']*)["'][^>]*>/gi,
    /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]{0,120}?(?:forgot password|lost password|reset password)[\s\S]{0,120}?<\/a>/gi,
  ];

  for (const pattern of hrefPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const candidate = match[1];
      try {
        return {
          url: new URL(candidate, baseUrl).toString(),
          source: pattern === hrefPatterns[0] ? "login_link" : "login_text_link",
        };
      } catch {
        continue;
      }
    }
  }

  return { url: null, source: "none" };
}

export async function discoverForgotPasswordUrl(site: {
  accountLoginUrl: string | null;
  wordpressUrl: string | null;
}): Promise<ForgotPasswordDiscovery> {
  const loginUrl = site.accountLoginUrl || null;
  if (loginUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(loginUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "OnboardingForgotPasswordDiscovery/1.0",
        },
      });

      if (response.ok) {
        const html = await response.text();
        const discovered = findForgotPasswordUrl(html, loginUrl);
        if (discovered.url) {
          return discovered;
        }
      }
    } catch {
      // fall through to deterministic defaults below
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const siteUrl = site.wordpressUrl || null;
  if (siteUrl) {
    try {
      return {
        url: new URL("/wp-login.php?action=lostpassword", siteUrl).toString(),
        source: "wp_default",
      };
    } catch {
      try {
        return {
          url: new URL("/my-account/lost-password", siteUrl).toString(),
          source: "woocommerce_default",
        };
      } catch {
        // continue
      }
    }
  }

  return { url: null, source: "none" };
}

export async function discoverSiteBranding(
  siteUrl: string
): Promise<SiteBrandingDiscovery> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(siteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "OnboardingSiteDiscovery/1.0",
      },
    });

    if (!response.ok) {
      return {
        detectedName: null,
        logoUrl: null,
        iconUrl: null,
      };
    }

    const html = await response.text();
    const title =
      matchMeta(html, [/<title[^>]*>([^<]+)<\/title>/i]) ||
      matchMeta(html, [
        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
      ]);

    const logoCandidate =
      matchMeta(html, [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      ]) ||
      matchMeta(html, [
        /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon[^"']*["']/i,
      ]);

    const iconCandidate = matchMeta(html, [
      /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i,
    ]);

    return {
      detectedName: title,
      logoUrl: absoluteUrl(siteUrl, logoCandidate),
      iconUrl: absoluteUrl(siteUrl, iconCandidate),
    };
  } catch {
    return {
      detectedName: null,
      logoUrl: null,
      iconUrl: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getSiteEmailBranding(site: {
  name: string;
  slug: string;
  supportEmail: string | null;
  emailFooterImageUrl: string | null;
  wordpressUrl: string | null;
  accountLoginUrl: string | null;
}): Promise<SiteEmailBranding> {
  const siteUrl = site.wordpressUrl || site.accountLoginUrl || null;
  const defaultSupportEmail =
    site.supportEmail || process.env.SUPPORT_EMAIL || "support@yourdomain.com";

  if (!siteUrl) {
    return {
      siteSlug: site.slug,
      siteName: site.name,
      supportEmail: defaultSupportEmail,
      footerImageUrl:
        site.emailFooterImageUrl || process.env.EMAIL_FOOTER_IMAGE_URL || undefined,
      logoUrl: site.emailFooterImageUrl || process.env.EMAIL_FOOTER_IMAGE_URL || undefined,
      primaryColor: "#1a3a6e",
      compactHeaderLogo: false, // TODO: configure per-site branding overrides if needed
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(siteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "OnboardingEmailBranding/1.0",
      },
    });

    if (!response.ok) {
      return {
        siteSlug: site.slug,
        siteName: site.name,
        supportEmail: defaultSupportEmail,
        footerImageUrl:
          site.emailFooterImageUrl || process.env.EMAIL_FOOTER_IMAGE_URL || undefined,
        logoUrl: site.emailFooterImageUrl || process.env.EMAIL_FOOTER_IMAGE_URL || undefined,
        primaryColor: "#1a3a6e",
        compactHeaderLogo: false, // TODO: configure per-site branding overrides if needed
      };
    }

    const html = await response.text();
    const discoveredName =
      matchMeta(html, [
        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
      ]) || matchMeta(html, [/<title[^>]*>([^<|–-]+)/i]);

    const logoCandidate =
      html.match(
        /<img[^>]+class=["'][^"']*custom-logo[^"']*["'][^>]+src=["']([^"']+)["']/i
      )?.[1] ||
      html.match(
        /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*custom-logo[^"']*["']/i
      )?.[1] ||
      matchMeta(html, [
        /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon[^"']*["']/i,
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      ]);

    const iconCandidate = matchMeta(html, [
      /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i,
    ]);

    const mailtoMatch = html.match(
      /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/
    );

    const discoveredLogoUrl = absoluteUrl(siteUrl, logoCandidate) || undefined;
    const discoveredIconUrl = absoluteUrl(siteUrl, iconCandidate) || undefined;

    return {
      siteSlug: site.slug,
      siteName: site.name || discoveredName?.trim() || site.slug,
      supportEmail: site.supportEmail || mailtoMatch?.[1] || defaultSupportEmail,
      footerImageUrl:
        discoveredLogoUrl ||
        site.emailFooterImageUrl ||
        process.env.EMAIL_FOOTER_IMAGE_URL ||
        undefined,
      logoUrl:
        discoveredLogoUrl ||
        site.emailFooterImageUrl ||
        process.env.EMAIL_FOOTER_IMAGE_URL ||
        undefined,
      iconUrl: discoveredIconUrl,
      primaryColor: extractPrimaryColor(html) || "#1a3a6e",
      compactHeaderLogo: false, // TODO: configure per-site branding overrides if needed
    };
  } catch {
    return {
      siteSlug: site.slug,
      siteName: site.name,
      supportEmail: defaultSupportEmail,
      footerImageUrl:
        site.emailFooterImageUrl || process.env.EMAIL_FOOTER_IMAGE_URL || undefined,
      logoUrl: site.emailFooterImageUrl || process.env.EMAIL_FOOTER_IMAGE_URL || undefined,
      primaryColor: "#1a3a6e",
      compactHeaderLogo: false, // TODO: configure per-site branding overrides if needed
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function buildSiteConfigFromInput(
  input: SiteCreateInput
): Promise<{ siteData: SiteConfigInput; branding: SiteBrandingDiscovery }> {
  const siteUrl = normalizeUrl(input.siteUrl);
  const slug =
    cleanOptionalString(input.slug) || slugifySiteName(input.name) || DEFAULT_SITE_SLUG;
  const branding = await discoverSiteBranding(siteUrl);
  const onboardingAppUrl = maybeUrl(process.env.NEXT_PUBLIC_APP_URL);
  const accountLoginUrl =
    maybeUrl(cleanOptionalString(input.accountLoginUrl)) || `${siteUrl}/login`;

  const supportEmail = cleanOptionalString(input.supportEmail);
  const smtpFromName =
    cleanOptionalString(input.smtpFromName) ||
    branding.detectedName ||
    input.name.trim();

  return {
    siteData: {
      slug,
      name: input.name.trim(),
      onboardingAppUrl,
      accountLoginUrl,
      wordpressUrl: siteUrl,
      wordpressRestApiUrl: `${siteUrl}/wp-json/wp/v2`,
      wordpressUsername: input.wordpressUsername.trim(),
      wordpressAppPassword: input.wordpressAppPassword.trim(),
      profilegridApiUrl: `${siteUrl}/wp-json/profilegrid/v1`,
      profilegridUsername: input.wordpressUsername.trim(),
      profilegridAppPassword: input.wordpressAppPassword.trim(),
      smtpHost: cleanOptionalString(input.smtpHost),
      smtpPort: maybeNumber(input.smtpPort),
      smtpSecure: input.smtpSecure ?? null,
      smtpUsername: cleanOptionalString(input.smtpUsername),
      smtpPassword: cleanOptionalString(input.smtpPassword),
      smtpFromEmail: cleanOptionalString(input.smtpFromEmail),
      smtpFromName,
      supportEmail,
      emailFooterImageUrl:
        maybeUrl(cleanOptionalString(input.emailFooterImageUrl)) || branding.logoUrl,
      n8nWebhookAuthKey: generateMachineKey(),
      n8nSyncWorkflowId: null,
      n8nReminderWorkflowId: null,
      breachResearchUrl:
        maybeUrl(cleanOptionalString(input.breachResearchUrl)) ||
        "https://haveibeenpwned.com",
    },
    branding,
  };
}

export function getDefaultSiteSeedData(): SiteConfigInput {
  return {
    slug: clean(process.env.DEFAULT_SITE_SLUG) || DEFAULT_SITE_SLUG,
    name: clean(process.env.DEFAULT_SITE_NAME) || "My Site",
    onboardingAppUrl: clean(process.env.NEXT_PUBLIC_APP_URL),
    accountLoginUrl:
      clean(process.env.ACCOUNT_LOGIN_URL) || "https://your-site.com/login",
    wordpressUrl: clean(process.env.WORDPRESS_URL),
    wordpressRestApiUrl: clean(process.env.WORDPRESS_REST_API_URL),
    wordpressUsername: clean(process.env.WORDPRESS_USERNAME),
    wordpressAppPassword: clean(process.env.WORDPRESS_APP_PASSWORD),
    profilegridApiUrl: clean(process.env.PROFILEGRID_API_URL),
    profilegridUsername:
      clean(process.env.PROFILEGRID_USERNAME) ||
      clean(process.env.WORDPRESS_USERNAME),
    profilegridAppPassword:
      clean(process.env.PROFILEGRID_APP_PASSWORD) ||
      clean(process.env.WORDPRESS_APP_PASSWORD),
    smtpHost: clean(process.env.SMTP_HOST),
    smtpPort: parseOptionalInt(process.env.SMTP_PORT),
    smtpSecure: parseOptionalBool(process.env.SMTP_SECURE),
    smtpUsername: clean(process.env.SMTP_USERNAME),
    smtpPassword: clean(process.env.SMTP_PASSWORD),
    smtpFromEmail: clean(process.env.SMTP_FROM_EMAIL),
    smtpFromName: clean(process.env.SMTP_FROM_NAME),
    supportEmail: clean(process.env.SUPPORT_EMAIL),
    emailFooterImageUrl: clean(process.env.EMAIL_FOOTER_IMAGE_URL),
    n8nWebhookAuthKey: clean(process.env.N8N_WEBHOOK_AUTH_KEY),
    n8nSyncWorkflowId: null,
    n8nReminderWorkflowId: null,
    breachResearchUrl:
      clean(process.env.BREACH_RESEARCH_URL) || "https://haveibeenpwned.com",
  };
}

export async function getDefaultSiteRecord() {
  const seed = getDefaultSiteSeedData();
  return prisma.site.findFirst({
    where: {
      OR: [{ slug: seed.slug }, { name: seed.name }],
      isActive: true,
    },
    orderBy: { id: "asc" },
  });
}

export async function listSites() {
  return prisma.site.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: { onboardingStates: true },
      },
    },
  });
}

export async function getSiteById(siteId: number) {
  return prisma.site.findUnique({ where: { id: siteId } });
}

export async function getSiteBySlug(slug: string) {
  return prisma.site.findUnique({ where: { slug } });
}

export async function resolveSiteSelection(input?: {
  siteId?: number | null;
  siteSlug?: string | null;
}) {
  if (input?.siteId) {
    return getSiteById(input.siteId);
  }
  if (input?.siteSlug?.trim()) {
    return getSiteBySlug(input.siteSlug.trim());
  }
  return getDefaultSiteRecord();
}

export function getProfileGridConfigForSite(site: {
  id: number;
  slug: string;
  profilegridApiUrl: string | null;
  profilegridUsername: string | null;
  profilegridAppPassword: string | null;
  wordpressUsername: string | null;
  wordpressAppPassword: string | null;
}): ProfileGridClientConfig {
  const profilegridApiUrl =
    site.profilegridApiUrl || process.env.PROFILEGRID_API_URL;
  const username =
    site.profilegridUsername ||
    site.wordpressUsername ||
    process.env.WORDPRESS_USERNAME;
  const applicationPassword =
    site.profilegridAppPassword ||
    site.wordpressAppPassword ||
    process.env.WORDPRESS_APP_PASSWORD;

  if (!profilegridApiUrl || !username || !applicationPassword) {
    throw new Error(`Site ${site.slug} is missing ProfileGrid credentials.`);
  }

  return {
    profilegridApiUrl,
    username,
    applicationPassword,
    cacheKey: `site:${site.id}`,
  };
}

export function getWpConfigForSite(site: {
  slug: string;
  wordpressRestApiUrl: string | null;
  wordpressUsername: string | null;
  wordpressAppPassword: string | null;
}): WPClientConfig {
  const wordpressRestApiUrl =
    site.wordpressRestApiUrl || process.env.WORDPRESS_REST_API_URL;
  const username = site.wordpressUsername || process.env.WORDPRESS_USERNAME;
  const applicationPassword =
    site.wordpressAppPassword || process.env.WORDPRESS_APP_PASSWORD;

  if (!wordpressRestApiUrl || !username || !applicationPassword) {
    throw new Error(`Site ${site.slug} is missing WordPress credentials.`);
  }

  return {
    wordpressRestApiUrl,
    username,
    applicationPassword,
    reassignUserId: process.env.WORDPRESS_REASSIGN_USER_ID,
  };
}

export function getMailerConfigForSite(site: {
  slug: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUsername: string | null;
  smtpPassword: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
}): MailerConfig {
  const host = site.smtpHost || process.env.SMTP_HOST;
  const port = site.smtpPort || parseOptionalInt(process.env.SMTP_PORT) || 465;
  const secure =
    site.smtpSecure ?? parseOptionalBool(process.env.SMTP_SECURE) ?? true;
  const username = site.smtpUsername || process.env.SMTP_USERNAME;
  const password = site.smtpPassword || process.env.SMTP_PASSWORD;
  const fromEmail = site.smtpFromEmail || process.env.SMTP_FROM_EMAIL;
  const fromName =
    site.smtpFromName || process.env.SMTP_FROM_NAME || site.slug.toUpperCase();

  if (!host || !username || !password || !fromEmail) {
    throw new Error(`Site ${site.slug} is missing SMTP credentials.`);
  }

  return {
    host,
    port,
    secure,
    username,
    password,
    fromEmail,
    fromName,
  };
}

export function getMachineAuthKeyForSite(site: {
  n8nWebhookAuthKey: string | null;
}): string | null {
  return site.n8nWebhookAuthKey?.trim() || null;
}

export function isValidMachineKeyForSite(
  site: { n8nWebhookAuthKey: string | null },
  providedKey: string | null
): boolean {
  const expected = getMachineAuthKeyForSite(site);
  if (!expected || !providedKey) return false;
  return expected === providedKey;
}
