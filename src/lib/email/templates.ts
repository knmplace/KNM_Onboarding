/**
 * Email templates for the onboarding pipeline.
 * 1. Admin Notification - new user pending approval
 * 2. Password Reminder - active user needs to change password
 * 3. Congratulations - onboarding complete
 */

import type { EmailBreachSummary } from "@/lib/abstract-api";
import type { SiteEmailBranding } from "@/lib/site-config";

interface UserInfo {
  displayName: string;
  email: string;
  wordpressId: string;
}

interface EmailValidation {
  qualityScore: number | null;
  isBreached: boolean | null;
  isDisposable: boolean | null;
  isFreeEmail: boolean | null;
  deliverable: boolean | null;
}

interface ReminderEmailContext {
  displayName: string;
  email: string;
  activationDate: Date;
  firstReminderDate: Date | null;
  previousReminderDates: Date[];
  reminderNumber: number;
  loginUrl: string;
  supportEmail: string;
  siteName: string;
  footerImageUrl?: string;
  primaryColor?: string;
  logoUrl?: string;
  compactHeaderLogo?: boolean;
  forgotPasswordUrl?: string;
}

const DEFAULT_SITE_NAME = process.env.DEFAULT_SITE_NAME || "My Site";
const DEFAULT_PRIMARY_COLOR = "#1a3a6e";

export type EmailBranding = Pick<
  SiteEmailBranding,
  | "siteSlug"
  | "siteName"
  | "supportEmail"
  | "footerImageUrl"
  | "logoUrl"
  | "iconUrl"
  | "primaryColor"
  | "compactHeaderLogo"
>;

const baseStyle = `
  body { margin: 0; padding: 0; background-color: #eef2f7; font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
  table { border-collapse: collapse; }
  .shell { width: 100%; background-color: #eef2f7; padding: 24px 0; }
  .card { width: 680px; max-width: 680px; background: #ffffff; border: 1px solid #dbe3ee; border-radius: 8px; overflow: hidden; }
  .brand { background: #334155; color: #ffffff; font-size: 12px; letter-spacing: 0.7px; text-transform: uppercase; text-align: center; padding: 12px 20px; }
  .hero { background: #1f3b57; color: #ffffff; text-align: center; padding: 28px 24px 24px; }
  .hero h1 { margin: 0; font-size: 24px; line-height: 1.3; font-weight: 600; }
  .hero p { margin: 10px 0 0; font-size: 14px; line-height: 1.6; color: #dbe7f3; }
  .content { padding: 24px 28px; background: #ffffff; }
  .intro { margin: 0 0 14px; font-size: 15px; line-height: 1.7; color: #334155; }
  .section { border: 1px solid #dbe3ee; border-radius: 6px; margin: 0 0 16px; }
  .section-head { background: #f4f7fb; color: #2f3f54; font-size: 13px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; padding: 10px 14px; }
  .section-body { padding: 12px 14px; background: #ffffff; }
  .kv { width: 100%; }
  .kv td { font-size: 14px; line-height: 1.6; padding: 4px 0; vertical-align: top; }
  .kv .k { width: 205px; color: #475569; font-weight: 600; }
  .kv .v { color: #1f2937; }
  .badge-ok { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #e8f5ed; color: #166534; }
  .badge-warn { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #fef3c7; color: #92400e; }
  .badge-danger { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #fee2e2; color: #991b1b; }
  .alert { margin: 0 0 16px; padding: 12px 14px; border-radius: 6px; font-size: 14px; line-height: 1.6; }
  .alert-danger { background: #fef2f2; border: 1px solid #fecaca; color: #7f1d1d; }
  .alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; }
  .cta-wrap { text-align: center; padding: 10px 0 6px; }
  .btn { display: inline-block; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 4px; padding: 12px 24px; }
  .btn-primary { background: #2563eb; color: #ffffff; }
  .btn-green { background: #15803d; color: #ffffff; }
  .support { margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: #475569; text-align: center; }
  .divider { border-top: 1px solid #dbe3ee; margin: 18px 0 0; }
  .logo-wrap { text-align: center; padding: 10px 0 2px; }
  .logo-img { width: 150px; max-width: 150px; height: 87px; max-height: 87px; object-fit: contain; display: inline-block; }
  .footer { text-align: center; font-size: 12px; color: #64748b; padding: 10px 0 24px; }
  .header { text-align: center; margin-bottom: 18px; }
  .header h1 { font-size: 22px; color: #1a1a1a; margin: 0; }
  .label { color: #666; font-size: 13px; }
  .value { color: #1a1a1a; font-size: 14px; font-weight: 500; }
  table.info { width: 100%; margin: 16px 0; }
  table.info td { padding: 6px 0; font-size: 13px; vertical-align: top; }
  table.info td:first-child { color: #666; width: 140px; }
`;

function clampColor(value: string | undefined): string {
  return /^#[0-9a-fA-F]{3,6}$/.test(value || "")
    ? (value as string)
    : DEFAULT_PRIMARY_COLOR;
}

function darken(color: string, amount = 24): string {
  const hex = clampColor(color).replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const value = Number.parseInt(full, 16);
  const r = Math.max(0, (value >> 16) - amount);
  const g = Math.max(0, ((value >> 8) & 0xff) - amount);
  const b = Math.max(0, (value & 0xff) - amount);
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function lighten(color: string, amount = 232): string {
  const hex = clampColor(color).replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const value = Number.parseInt(full, 16);
  const r = Math.min(255, (value >> 16) + amount);
  const g = Math.min(255, ((value >> 8) & 0xff) + amount);
  const b = Math.min(255, (value & 0xff) + amount);
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function withBranding(branding?: Partial<EmailBranding>): EmailBranding {
  return {
    siteSlug: branding?.siteSlug,
    siteName: branding?.siteName || DEFAULT_SITE_NAME,
    supportEmail: branding?.supportEmail || process.env.SUPPORT_EMAIL || "support@yourdomain.com",
    footerImageUrl: branding?.footerImageUrl,
    logoUrl: branding?.logoUrl || branding?.footerImageUrl,
    iconUrl: branding?.iconUrl,
    primaryColor: clampColor(branding?.primaryColor),
    compactHeaderLogo: Boolean(branding?.compactHeaderLogo),
  };
}

function brandBar(branding?: Partial<EmailBranding>): string {
  const resolved = withBranding(branding);
  const logoUrl = resolved.logoUrl || resolved.iconUrl;
  const initial = resolved.siteName.charAt(0).toUpperCase();

  if (resolved.compactHeaderLogo) {
    return `
      <div class="brand brand-compact">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td class="brand-compact-name-cell" align="center">
              <div class="brand-name">${resolved.siteName} Secure Onboarding</div>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  return `
    <div class="brand">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left" style="padding: 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="85" valign="middle" style="padding: 0;">
                  <div class="brand-logo">
                    ${
                      logoUrl
                        ? `<img src="${logoUrl}" alt="${resolved.siteName} logo" class="brand-logo-img" width="85" height="100" />`
                        : `<span class="brand-logo-fallback">${initial}</span>`
                    }
                  </div>
                </td>
                <td valign="middle" align="left" style="padding-left: 10px;">
                  <div class="brand-name">${resolved.siteName} Secure Onboarding</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function wrap(content: string, branding?: Partial<EmailBranding>): string {
  const resolved = withBranding(branding);
  const primary = resolved.primaryColor;
  const primaryDark = darken(primary, 26);
  const primaryLight = lighten(primary, 235);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${baseStyle}
  .brand { background: ${primaryDark}; }
  .brand-logo { width: 85px; height: 100px; border-radius: 0; background: transparent; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
  .brand-logo-img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .brand-wordmark-img { width: 152px; max-width: 152px; height: 56px; max-height: 56px; object-fit: contain; display: block; }
  .brand-logo-fallback { color: ${primaryDark}; font-size: 18px; font-weight: 800; line-height: 1; }
  .brand-name { color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase; }
  .brand-compact { background: #ffffff; }
  .brand-compact-name-cell { padding: 3px 20px; background: ${primaryDark}; }
  .hero { background: ${primary}; }
  .btn-primary { background: ${primary}; }
  .btn-green { background: ${primaryDark}; }
  .alert-site { background: ${primaryLight}; border: 1px solid ${primary}; color: ${primaryDark}; }
</style></head>
<body>
  <table role="presentation" class="shell" width="100%">
    <tr>
      <td align="center">
        <table role="presentation" class="card" width="680">
          ${content}
        </table>
        <div class="footer">${resolved.siteName} Onboarding System</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Template 1: Admin Notification - New user pending approval
 */
export function adminNotificationEmail(
  user: UserInfo,
  validation: EmailValidation,
  dashboardUrl: string,
  branding?: Partial<EmailBranding>
): { subject: string; html: string } {
  const resolved = withBranding(branding);
  const qualityPct =
    validation.qualityScore !== null
      ? `${(validation.qualityScore * 100).toFixed(0)}%`
      : "N/A";

  const breachBadge = validation.isBreached
    ? '<span class="badge-danger">BREACHED</span>'
    : '<span class="badge-ok">Clean</span>';

  const deliverableBadge = validation.deliverable
    ? '<span class="badge-ok">Deliverable</span>'
    : '<span class="badge-warn">Undeliverable</span>';

  const disposableBadge = validation.isDisposable
    ? '<span class="badge-danger">Disposable</span>'
    : '<span class="badge-ok">Legitimate</span>';

  const breachAlert = validation.isBreached
    ? `<div class="alert alert-danger"><strong>Security Alert:</strong> This user's email address has been found in known data breaches. Exercise caution when approving.</div>`
    : "";

  const html = wrap(`
    ${brandBar(resolved)}
    ${contentLogoBlock(resolved)}
    <div class="header"><h1>New User Pending Approval</h1></div>
    <p style="font-size: 14px; color: #333;">A new user has registered on ${resolved.siteName} and is awaiting your approval.</p>

    <table class="info">
      <tr><td>Name</td><td class="value">${user.displayName}</td></tr>
      <tr><td>Email</td><td class="value">${user.email}</td></tr>
      <tr><td>WordPress ID</td><td class="value">${user.wordpressId}</td></tr>
    </table>

    <h3 style="font-size: 15px; margin-top: 24px;">Email Validation</h3>
    <table class="info">
      <tr><td>Quality Score</td><td>${qualityPct}</td></tr>
      <tr><td>Deliverable</td><td>${deliverableBadge}</td></tr>
      <tr><td>Disposable</td><td>${disposableBadge}</td></tr>
      <tr><td>Free Email</td><td>${validation.isFreeEmail ? "Yes" : "No"}</td></tr>
      <tr><td>Breach Status</td><td>${breachBadge}</td></tr>
    </table>

    ${breachAlert}

    <div style="text-align: center; margin-top: 24px;">
      <a href="${dashboardUrl}" class="btn btn-primary">Review in Dashboard</a>
    </div>
    <p style="font-size: 13px; color: #475569; margin-top: 14px; text-align: center;">If you need help, contact <a href="mailto:${resolved.supportEmail}">${resolved.supportEmail}</a>.</p>
    ${footerImageBlock(resolved.footerImageUrl, resolved.siteName)}
  `, resolved);

  return {
    subject: `[${resolved.siteName}] New User Pending: ${user.displayName}`,
    html,
  };
}

/**
 * Template: Pending-approval breach alert sent to user
 */
export function pendingBreachAlertEmail(
  user: UserInfo,
  breachSummary: EmailBreachSummary,
  researchUrl: string,
  branding?: Partial<EmailBranding>
): { subject: string; html: string } {
  const resolved = withBranding(branding);
  const breachCountLabel =
    breachSummary.breachCount > 0
      ? `${breachSummary.breachCount} known breach${breachSummary.breachCount === 1 ? "" : "es"}`
      : "potential breach-related records";

  const dateRange =
    breachSummary.firstBreachDate && breachSummary.lastBreachDate
      ? `${breachSummary.firstBreachDate} to ${breachSummary.lastBreachDate}`
      : breachSummary.lastBreachDate || breachSummary.firstBreachDate || "Dates unavailable";

  const topDomains =
    breachSummary.topDomains.length > 0
      ? `<ul style="font-size: 13px; color: #1f2937; margin: 6px 0 0 16px; padding: 0;">
          ${breachSummary.topDomains
            .map(
              (item) =>
                `<li style="margin: 4px 0;">${item.domain}${item.breachDate ? ` (${item.breachDate})` : ""}</li>`
            )
            .join("")}
        </ul>`
      : `<p style="font-size: 13px; color: #475569; margin: 6px 0 0;">Specific affected sites were not provided by the data source.</p>`;

  const html = wrap(`
    ${brandBar(resolved)}
    ${contentLogoBlock(resolved)}
    <div class="header"><h1>Security Notice</h1></div>
    <p style="font-size: 14px; color: #333;">Hi ${user.displayName},</p>
    <p style="font-size: 14px; color: #333;">As part of onboarding, we checked your email reputation. Your email address may have been involved in ${breachCountLabel}.</p>

    <div class="alert alert-info">
      <strong>Important:</strong> This is an informational alert and does not confirm that your ${resolved.siteName} account has been compromised.
    </div>

    <h3 style="font-size: 15px; margin-top: 20px;">What we found</h3>
    <table class="info">
      <tr><td>Breach count</td><td>${breachSummary.breachCount || "N/A"}</td></tr>
      <tr><td>Date range</td><td>${dateRange}</td></tr>
    </table>
    <div style="margin-top: 10px;">
      <p style="font-size: 13px; color: #475569; margin: 0;"><strong>Possible sites involved (up to 3):</strong></p>
      ${topDomains}
    </div>

    <h3 style="font-size: 15px; margin-top: 20px;">Recommended next steps</h3>
    <ol style="font-size: 13px; color: #333; margin: 8px 0 0; padding-left: 20px;">
      <li>Change your ${resolved.siteName} password and any reused passwords on other sites.</li>
      <li>Use a unique password for each site (a password manager can help).</li>
      <li>Enable multi-factor authentication where available.</li>
      <li>Research your email exposure at <a href="${researchUrl}">${researchUrl}</a>.</li>
    </ol>

    <div style="text-align: center; margin-top: 24px;">
      <a href="${researchUrl}" class="btn btn-primary">Research Breach Exposure</a>
    </div>
    <p style="font-size: 13px; color: #475569; margin-top: 18px; text-align: center;">If you have questions, contact <a href="mailto:${resolved.supportEmail}">${resolved.supportEmail}</a>.</p>
    ${footerImageBlock(resolved.footerImageUrl, resolved.siteName)}
  `, resolved);

  return {
    subject: `${resolved.siteName} Security Notice About Your Email Address`,
    html,
  };
}

export function periodicBreachAlertEmail(
  user: UserInfo,
  breachSummary: EmailBreachSummary,
  researchUrl: string,
  branding?: Partial<EmailBranding>
): { subject: string; html: string } {
  const resolved = withBranding(branding);
  const breachCountLabel =
    breachSummary.breachCount > 0
      ? `${breachSummary.breachCount} known breach${breachSummary.breachCount === 1 ? "" : "es"}`
      : "potential breach-related records";

  const dateRange =
    breachSummary.firstBreachDate && breachSummary.lastBreachDate
      ? `${breachSummary.firstBreachDate} to ${breachSummary.lastBreachDate}`
      : breachSummary.lastBreachDate ||
        breachSummary.firstBreachDate ||
        "Dates unavailable";

  const topDomains =
    breachSummary.topDomains.length > 0
      ? `<ul style="font-size: 13px; color: #1f2937; margin: 6px 0 0 16px; padding: 0;">
          ${breachSummary.topDomains
            .map(
              (item) =>
                `<li style="margin: 4px 0;">${item.domain}${item.breachDate ? ` (${item.breachDate})` : ""}</li>`
            )
            .join("")}
        </ul>`
      : `<p style="font-size: 13px; color: #475569; margin: 6px 0 0;">Specific affected sites were not provided by the data source.</p>`;

  const html = wrap(`
    ${brandBar(resolved)}
    ${contentLogoBlock(resolved)}
    <div class="header"><h1>Security Check Notice</h1></div>
    <p style="font-size: 14px; color: #333;">Hi ${user.displayName},</p>
    <p style="font-size: 14px; color: #333;">During a recent security review, your email address appeared in ${breachCountLabel} in third-party breach datasets.</p>

    <div class="alert alert-info">
      <strong>Important:</strong> This is an informational notice and does not confirm your ${resolved.siteName} account was compromised.
    </div>

    <h3 style="font-size: 15px; margin-top: 20px;">Summary</h3>
    <table class="info">
      <tr><td>Breach count</td><td>${breachSummary.breachCount || "N/A"}</td></tr>
      <tr><td>Date range</td><td>${dateRange}</td></tr>
    </table>
    <div style="margin-top: 10px;">
      <p style="font-size: 13px; color: #475569; margin: 0;"><strong>Possible sites involved (up to 3):</strong></p>
      ${topDomains}
    </div>

    <h3 style="font-size: 15px; margin-top: 20px;">Recommended next steps</h3>
    <ol style="font-size: 13px; color: #333; margin: 8px 0 0; padding-left: 20px;">
      <li>Change your ${resolved.siteName} password and any reused passwords on other sites.</li>
      <li>Use a unique password for each site (a password manager can help).</li>
      <li>Enable multi-factor authentication where available.</li>
      <li>Research your email exposure at <a href="${researchUrl}">${researchUrl}</a>.</li>
    </ol>

    <div style="text-align: center; margin-top: 24px;">
      <a href="${researchUrl}" class="btn btn-primary">Research Breach Exposure</a>
    </div>
    <p style="font-size: 13px; color: #475569; margin-top: 18px; text-align: center;">If you have questions, contact <a href="mailto:${resolved.supportEmail}">${resolved.supportEmail}</a>.</p>
    ${footerImageBlock(resolved.footerImageUrl, resolved.siteName)}
  `, resolved);

  return {
    subject: `${resolved.siteName} Security Review: Email Breach Exposure Notice`,
    html,
  };
}

/**
 * Template 2: Password Reminder - User needs to change default password
 */
export function passwordReminderEmail(
  user: UserInfo,
  isBreached: boolean,
  reminderCount: number,
  loginUrl: string,
  branding?: Partial<EmailBranding>
): { subject: string; html: string } {
  const resolved = withBranding(branding);
  if (reminderCount === 0) {
    const awarenessMessage = isBreached
      ? `<div class="alert alert-danger"><strong>Security Awareness Notice:</strong> Our registration-time scan found your email in known third-party breach data. This does <strong>not</strong> mean ${resolved.siteName} was breached. We recommend updating passwords anywhere they may have been reused.</div>`
      : "";

    const html = wrap(`
      ${brandBar(resolved)}
      ${contentLogoBlock(resolved)}
      <div class="header"><h1>Welcome to ${resolved.siteName}</h1></div>
      <p style="font-size: 14px; color: #333;">Hi ${user.displayName},</p>
      <p style="font-size: 14px; color: #333;">Your account has been approved and activated.</p>

      ${awarenessMessage}

      <div style="background: #f8fafc; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <p style="font-size: 13px; color: #333; margin: 0 0 8px 0;">
          A separate account activation email from the site includes your account login details and temporary password.
        </p>
        <p style="font-size: 13px; color: #333; margin: 0;">
          For security, please sign in and change that temporary password as soon as possible.
        </p>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${loginUrl}" class="btn btn-primary">Go to Login</a>
      </div>
      <p style="font-size: 13px; color: #475569; margin-top: 14px; text-align: center;">
        Direct login link: <a href="${loginUrl}">${loginUrl}</a>
      </p>
      <p style="font-size: 13px; color: #475569; margin-top: 14px; text-align: center;">If you need help, contact <a href="mailto:${resolved.supportEmail}">${resolved.supportEmail}</a>.</p>
      ${footerImageBlock(resolved.footerImageUrl, resolved.siteName)}
    `, resolved);

    return {
      subject: isBreached
        ? `${resolved.siteName} Welcome and Security Awareness`
        : `${resolved.siteName} Account Approved - Action Required`,
      html,
    };
  }

  const breachWarning = isBreached
    ? `<div class="alert alert-danger"><strong>Important Security Notice:</strong> Your email address has been found in a known data breach. We strongly recommend using a unique, strong password for ${resolved.siteName} that you do not use on any other website.</div>`
    : "";

  const urgency =
    reminderCount >= 2
      ? `<div class="alert alert-info">This is reminder #${reminderCount + 1}. Please update your password to complete your account setup.</div>`
      : "";

  const html = wrap(`
    ${brandBar(resolved)}
    ${contentLogoBlock(resolved)}
    <div class="header"><h1>Please Change Your Password</h1></div>
    <p style="font-size: 14px; color: #333;">Hi ${user.displayName},</p>
    <p style="font-size: 14px; color: #333;">Welcome to ${resolved.siteName}! Your account has been approved. To complete your setup, please log in and change your default password.</p>

    ${breachWarning}
    ${urgency}

    <div style="background: #f8fafc; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <p style="font-size: 13px; color: #666; margin: 0 0 8px 0;"><strong>How to change your password:</strong></p>
      <ol style="font-size: 13px; color: #333; margin: 0; padding-left: 20px;">
        <li>Log in to your account</li>
        <li>Go to your Profile settings</li>
        <li>Update your password to something unique and strong</li>
      </ol>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="${loginUrl}" class="btn btn-primary">Log In Now</a>
    </div>
    <p style="font-size: 13px; color: #475569; margin-top: 14px; text-align: center;">
      Direct login link: <a href="${loginUrl}">${loginUrl}</a>
    </p>
    <p style="font-size: 13px; color: #475569; margin-top: 14px; text-align: center;">If you need help, contact <a href="mailto:${resolved.supportEmail}">${resolved.supportEmail}</a>.</p>
    ${footerImageBlock(resolved.footerImageUrl, resolved.siteName)}
  `, resolved);

  return {
    subject: `${resolved.siteName} Please Change Your Password${reminderCount > 0 ? ` (Reminder ${reminderCount + 1})` : ""}`,
    html,
  };
}

/**
 * Template 3: Congratulations - Onboarding complete
 */
export function congratulationsEmail(
  user: UserInfo,
  profileUrl: string,
  branding?: Partial<EmailBranding>
): { subject: string; html: string } {
  const resolved = withBranding(branding);
  const html = wrap(`
    ${brandBar(resolved)}
    ${contentLogoBlock(resolved)}
    <div class="header"><h1>Welcome to ${resolved.siteName}!</h1></div>
    <p style="font-size: 14px; color: #333;">Hi ${user.displayName},</p>
    <p style="font-size: 14px; color: #333;">Congratulations! Your account setup is complete. You're all set to explore the community.</p>

    <div style="background: #f0fdf4; border-radius: 6px; padding: 16px; margin: 16px 0; text-align: center;">
      <p style="font-size: 14px; color: #166534; margin: 0;">Your profile is ready to go!</p>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="${profileUrl}" class="btn btn-green">View Your Profile</a>
    </div>

    <p style="font-size: 13px; color: #666; margin-top: 24px;">If you have any questions, feel free to reach out. We're glad to have you as part of the community.</p>
    ${footerImageBlock(resolved.footerImageUrl, resolved.siteName)}
  `, resolved);

  return {
    subject: `[${resolved.siteName}] Welcome to the Community!`,
    html,
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function reminderHistoryBlock(
  activationDate: Date,
  firstReminderDate: Date | null,
  previousReminderDates: Date[]
): string {
  const previousDates =
    previousReminderDates.length > 0
      ? previousReminderDates
          .map((d) => formatDate(d))
          .join(", ")
      : "No prior reminders";

  return `
    <table role="presentation" class="section" width="100%">
      <tr><td class="section-head">Reminder Timeline</td></tr>
      <tr>
        <td class="section-body">
          <table role="presentation" class="kv" width="100%">
            <tr><td class="k">Account activated</td><td class="v">${formatDate(activationDate)}</td></tr>
            <tr><td class="k">Activity status</td><td class="v">${firstReminderDate ? "In progress" : "Initial reminder stage"}</td></tr>
            <tr><td class="k">First reminder sent</td><td class="v">${firstReminderDate ? formatDate(firstReminderDate) : "This is the first reminder."}</td></tr>
            <tr><td class="k">Previous reminder dates</td><td class="v">${previousDates}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function footerImageBlock(url?: string, alt = DEFAULT_SITE_NAME): string {
  if (!url) return "";
  return `<div class="divider"></div><div style="height: 10px;"></div><div class="logo-wrap"><img src="${url}" alt="${alt}" class="logo-img" width="150" height="87" /></div>`;
}

function contentLogoBlock(branding?: Partial<EmailBranding>): string {
  const resolved = withBranding(branding);
  if (!resolved.compactHeaderLogo || !resolved.logoUrl) return "";
  return `<div class="logo-wrap" style="padding: 2px 0 18px;"><img src="${resolved.logoUrl}" alt="${resolved.siteName}" class="brand-wordmark-img" width="152" height="56" /></div>`;
}

export function noLoginReminderEmail(
  context: ReminderEmailContext
): { subject: string; html: string } {
  const branding = withBranding({
    siteName: context.siteName,
    supportEmail: context.supportEmail,
    footerImageUrl: context.footerImageUrl,
    logoUrl: context.logoUrl,
    primaryColor: context.primaryColor,
    compactHeaderLogo: context.compactHeaderLogo,
  });
  const history = reminderHistoryBlock(
    context.activationDate,
    context.firstReminderDate,
    context.previousReminderDates
  );

  const html = wrap(`
    <tr><td>${brandBar(branding)}</td></tr>
    <tr>
      <td class="hero">
        <h1>Account Action Required</h1>
        <p>Your account is active, but no login activity has been detected yet.</p>
      </td>
    </tr>
    <tr>
      <td class="content">
        ${contentLogoBlock(branding)}
        <p class="intro">Hello ${context.displayName},</p>
        <p class="intro">This is a formal onboarding reminder. To maintain account access, please sign in and change your temporary password promptly.</p>

        <table role="presentation" class="section" width="100%">
          <tr><td class="section-head">Current Status</td></tr>
          <tr>
            <td class="section-body">
              <table role="presentation" class="kv" width="100%">
                <tr><td class="k">Login activity</td><td class="v"><span class="badge-warn">No login detected</span></td></tr>
                <tr><td class="k">Password status</td><td class="v">Temporary password has not been changed</td></tr>
                <tr><td class="k">Reminder number</td><td class="v">${context.reminderNumber}</td></tr>
                <tr><td class="k">Required action</td><td class="v">Log in and update password</td></tr>
              </table>
            </td>
          </tr>
        </table>

        ${history}

        <div class="cta-wrap">
          <a href="${context.loginUrl}" class="btn btn-primary">Log In and Update Password</a>
        </div>
        ${
          context.forgotPasswordUrl
            ? `<p class="support">Forgot your password? <a href="${context.forgotPasswordUrl}">Reset it here</a>.</p>`
            : ""
        }
        <p class="support">If you need assistance, contact <a href="mailto:${context.supportEmail}">${context.supportEmail}</a>.</p>
        ${footerImageBlock(context.footerImageUrl, context.siteName)}
      </td>
    </tr>
  `, branding);

  return {
    subject: `${context.siteName} Reminder ${context.reminderNumber}: Account Active, Login Required`,
    html,
  };
}

export function loggedInPasswordReminderEmail(
  context: ReminderEmailContext,
  lastLoginAt: Date
): { subject: string; html: string } {
  const branding = withBranding({
    siteName: context.siteName,
    supportEmail: context.supportEmail,
    footerImageUrl: context.footerImageUrl,
    logoUrl: context.logoUrl,
    primaryColor: context.primaryColor,
    compactHeaderLogo: context.compactHeaderLogo,
  });
  const history = reminderHistoryBlock(
    context.activationDate,
    context.firstReminderDate,
    context.previousReminderDates
  );

  const html = wrap(`
    <tr><td>${brandBar(branding)}</td></tr>
    <tr>
      <td class="hero">
        <h1>Password Update Required</h1>
        <p>Login activity was detected, but your temporary password remains active.</p>
      </td>
    </tr>
    <tr>
      <td class="content">
        ${contentLogoBlock(branding)}
        <p class="intro">Hello ${context.displayName},</p>
        <p class="intro">For account security and policy compliance, please complete your password update as soon as possible.</p>

        <table role="presentation" class="section" width="100%">
          <tr><td class="section-head">Activity Summary</td></tr>
          <tr>
            <td class="section-body">
              <table role="presentation" class="kv" width="100%">
                <tr><td class="k">Most recent login</td><td class="v">${formatDate(lastLoginAt)}</td></tr>
                <tr><td class="k">Password status</td><td class="v"><span class="badge-warn">Temporary password still in use</span></td></tr>
                <tr><td class="k">Reminder number</td><td class="v">${context.reminderNumber}</td></tr>
                <tr><td class="k">Required action</td><td class="v">Change password to complete onboarding</td></tr>
              </table>
            </td>
          </tr>
        </table>

        ${history}

        <div class="cta-wrap">
          <a href="${context.loginUrl}" class="btn btn-primary">Change Password Now</a>
        </div>
        ${
          context.forgotPasswordUrl
            ? `<p class="support">Forgot your password? <a href="${context.forgotPasswordUrl}">Reset it here</a>.</p>`
            : ""
        }
        <p class="support">If you need assistance, contact <a href="mailto:${context.supportEmail}">${context.supportEmail}</a>.</p>
        ${footerImageBlock(context.footerImageUrl, context.siteName)}
      </td>
    </tr>
  `, branding);

  return {
    subject: `${context.siteName} Reminder ${context.reminderNumber}: Please Change Your Password`,
    html,
  };
}

export function accountDeactivatedEmail(
  context: ReminderEmailContext,
  hadLoginActivity: boolean
): { subject: string; html: string } {
  const branding = withBranding({
    siteName: context.siteName,
    supportEmail: context.supportEmail,
    footerImageUrl: context.footerImageUrl,
    logoUrl: context.logoUrl,
    primaryColor: context.primaryColor,
    compactHeaderLogo: context.compactHeaderLogo,
  });
  const history = reminderHistoryBlock(
    context.activationDate,
    context.firstReminderDate,
    context.previousReminderDates
  );

  const reason = hadLoginActivity
    ? "Your account remained on a temporary password beyond the required security window."
    : "No account activity and no password change were detected within the required window.";

  const html = wrap(`
    <tr><td>${brandBar(branding)}</td></tr>
    <tr>
      <td class="hero">
        <h1>Account Deactivated</h1>
        <p>Your account was deactivated due to incomplete onboarding security requirements.</p>
      </td>
    </tr>
    <tr>
      <td class="content">
        ${contentLogoBlock(branding)}
        <p class="intro">Hello ${context.displayName},</p>
        <p class="intro">Your account has been placed in an inactive state. Please review the details below and contact support to request reactivation.</p>
        <div class="alert alert-danger"><strong>Deactivation reason:</strong> ${reason}</div>
        ${history}
        <table role="presentation" class="section" width="100%">
          <tr><td class="section-head">Next Step</td></tr>
          <tr>
            <td class="section-body">
              <table role="presentation" class="kv" width="100%">
                <tr><td class="k">Support contact</td><td class="v"><a href="mailto:${context.supportEmail}">${context.supportEmail}</a></td></tr>
                <tr><td class="k">Requested action</td><td class="v">Account reset and reactivation review</td></tr>
              </table>
            </td>
          </tr>
        </table>
        ${footerImageBlock(context.footerImageUrl, context.siteName)}
      </td>
    </tr>
  `, branding);

  return {
    subject: `${context.siteName} Account Deactivated - Support Required`,
    html,
  };
}
