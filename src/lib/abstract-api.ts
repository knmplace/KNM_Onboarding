/**
 * Abstract API Email Reputation Client
 * Validated against live API on 2026-03-04.
 * Endpoint: https://emailreputation.abstractapi.com/v1
 *
 * Note: The emailvalidation endpoint returns 401 with this key.
 * The emailreputation endpoint is the correct one and returns
 * richer data including breach info.
 */

export interface AbstractEmailResponse {
  email_address: string;
  email_deliverability: {
    status: string; // "deliverable" | "undeliverable" | "unknown"
    status_detail: string;
    is_format_valid: boolean;
    is_smtp_valid: boolean;
    is_mx_valid: boolean;
    mx_records: string[];
  };
  email_sender: {
    first_name: string | null;
    last_name: string | null;
    email_provider_name: string;
    organization_name: string | null;
    organization_type: string | null;
  };
  email_domain: {
    domain: string;
    domain_age: number;
    is_live_site: boolean;
    registrar: string;
    registrar_url: string;
    date_registered: string;
    date_last_renewed: string;
    date_expires: string;
    is_risky_tld: boolean;
  };
  email_quality: {
    score: number; // 0-1
    is_free_email: boolean;
    is_username_suspicious: boolean;
    is_disposable: boolean;
    is_catchall: boolean;
    is_subaddress: boolean;
    is_role: boolean;
    is_dmarc_enforced: boolean;
    is_spf_strict: boolean;
    minimum_age: number;
  };
  email_risk: {
    address_risk_status: string; // "low" | "medium" | "high"
    domain_risk_status: string;
  };
  email_breaches: {
    total_breaches: number;
    date_first_breached: string | null;
    date_last_breached: string | null;
    breached_domains: Array<{
      domain: string;
      breach_date: string;
    }>;
  };
}

export interface EmailValidationResult {
  email: string;
  valid: boolean;
  deliverable: boolean;
  qualityScore: number;
  isDisposable: boolean;
  isFreeEmail: boolean;
  isCatchAll: boolean;
  isBreached: boolean;
  breachCount: number;
  riskLevel: string;
  validationError: string | null;
  raw: AbstractEmailResponse;
}

export interface EmailBreachSummary {
  breachCount: number;
  topDomains: Array<{
    domain: string;
    breachDate: string | null;
  }>;
  firstBreachDate: string | null;
  lastBreachDate: string | null;
}

import { getSetting } from "@/lib/app-settings";

const ABSTRACT_API_URL = "https://emailreputation.abstractapi.com/v1";

// Rate limiting: Abstract API requires 3-6 seconds between requests
const ABSTRACT_RATE_LIMIT_MS = 4000; // 4 seconds between requests
let lastAbstractRequestTime = 0;
let abstractRequestQueue: Promise<void> = Promise.resolve();

async function throttleAbstractApi(): Promise<void> {
  const run = async () => {
    const now = Date.now();
    const elapsed = now - lastAbstractRequestTime;
    if (elapsed < ABSTRACT_RATE_LIMIT_MS) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, ABSTRACT_RATE_LIMIT_MS - elapsed)
      );
    }
    lastAbstractRequestTime = Date.now();
  };

  // Serialize requests in-process so concurrent callers still respect delay.
  const scheduled = abstractRequestQueue.then(run, run);
  abstractRequestQueue = scheduled.catch(() => undefined);
  await scheduled;
}

/**
 * Local email format validation (run before API call to save requests)
 */
export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate email via Abstract API Email Reputation endpoint.
 * Automatically throttles to 4 seconds between API requests to respect rate limits.
 */
async function resolveApiKey(): Promise<string | null> {
  const envKey = process.env.ABSTRACT_API_KEY;
  if (envKey && envKey !== "PLACEHOLDER_CHANGE_ME") return envKey;
  return getSetting("ABSTRACT_API_KEY");
}

export async function validateEmail(
  email: string
): Promise<EmailValidationResult> {
  const apiKey = await resolveApiKey();
  if (!apiKey) {
    throw new Error("ABSTRACT_API_KEY not configured");
  }

  if (!isValidEmailFormat(email)) {
    return {
      email,
      valid: false,
      deliverable: false,
      qualityScore: 0,
      isDisposable: false,
      isFreeEmail: false,
      isCatchAll: false,
      isBreached: false,
      breachCount: 0,
      riskLevel: "unknown",
      validationError: "Invalid email format",
      raw: {} as AbstractEmailResponse,
    };
  }

  // Enforce rate limit before making the API call
  await throttleAbstractApi();

  const url = `${ABSTRACT_API_URL}?api_key=${apiKey}&email=${encodeURIComponent(email)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Abstract API error: ${response.status} ${response.statusText}`
    );
  }

  const data: AbstractEmailResponse = await response.json();

  const valid =
    data.email_deliverability.is_format_valid &&
    data.email_deliverability.is_mx_valid &&
    !data.email_quality.is_disposable;

  const deliverable = data.email_deliverability.status === "deliverable";
  const isBreached = data.email_breaches.total_breaches > 0;

  return {
    email: data.email_address,
    valid,
    deliverable,
    qualityScore: data.email_quality.score,
    isDisposable: data.email_quality.is_disposable,
    isFreeEmail: data.email_quality.is_free_email,
    isCatchAll: data.email_quality.is_catchall,
    isBreached,
    breachCount: data.email_breaches.total_breaches,
    riskLevel: data.email_risk.address_risk_status,
    validationError: valid ? null : "Email failed validation checks",
    raw: data,
  };
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: Date | null): string | null {
  if (!value) return null;
  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function extractEmailBreachSummary(
  raw: unknown,
  topN = 3
): EmailBreachSummary {
  const safeTopN = topN > 0 ? topN : 3;
  const result: EmailBreachSummary = {
    breachCount: 0,
    topDomains: [],
    firstBreachDate: null,
    lastBreachDate: null,
  };

  if (!raw || typeof raw !== "object") {
    return result;
  }

  const rawRecord = raw as Record<string, unknown>;

  const breaches =
    rawRecord.email_breaches && typeof rawRecord.email_breaches === "object"
      ? (rawRecord.email_breaches as Record<string, unknown>)
      : null;

  if (!breaches) {
    return result;
  }

  const totalBreaches =
    typeof breaches.total_breaches === "number"
      ? breaches.total_breaches
      : 0;

  type DomainEntry = { domain: string; breachDate: Date | null };
  const domainsRaw =
    Array.isArray(breaches.breached_domains)
      ? breaches.breached_domains
      : [];

  const domains: DomainEntry[] = domainsRaw
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.domain === "string" &&
        item.domain.trim().length > 0
    )
    .map((item) => ({
      domain: item.domain.trim(),
      breachDate: parseDate(item.breach_date),
    }))
    .sort((a, b) => {
      const aTime = a.breachDate?.getTime() ?? 0;
      const bTime = b.breachDate?.getTime() ?? 0;
      return bTime - aTime;
    });

  const explicitFirst =
    parseDate(breaches.date_first_breached);
  const explicitLast =
    parseDate(breaches.date_last_breached);

  const datedDomains = domains
    .map((entry) => entry.breachDate)
    .filter((date): date is Date => Boolean(date));
  const computedFirst =
    datedDomains.length > 0
      ? new Date(Math.min(...datedDomains.map((d) => d.getTime())))
      : null;
  const computedLast =
    datedDomains.length > 0
      ? new Date(Math.max(...datedDomains.map((d) => d.getTime())))
      : null;

  result.breachCount = Math.max(totalBreaches, domains.length);
  result.topDomains = domains.slice(0, safeTopN).map((entry) => ({
    domain: entry.domain,
    breachDate: formatDate(entry.breachDate),
  }));
  result.firstBreachDate = formatDate(explicitFirst ?? computedFirst);
  result.lastBreachDate = formatDate(explicitLast ?? computedLast);

  return result;
}
