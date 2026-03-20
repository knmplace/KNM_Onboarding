/**
 * WordPress REST API Client
 * Validated against live API on 2026-03-04.
 */

export interface WPClientConfig {
  wordpressRestApiUrl: string;
  username: string;
  applicationPassword: string;
  reassignUserId?: string | null;
}

function getDefaultConfig(): WPClientConfig {
  return {
    wordpressRestApiUrl: process.env.WORDPRESS_REST_API_URL!,
    username: process.env.WORDPRESS_USERNAME!,
    applicationPassword: process.env.WORDPRESS_APP_PASSWORD!,
    reassignUserId: process.env.WORDPRESS_REASSIGN_USER_ID,
  };
}

function getAuthHeader(config: WPClientConfig): string {
  const credentials = Buffer.from(
    `${config.username}:${config.applicationPassword}`
  ).toString("base64");
  return `Basic ${credentials}`;
}

export interface WPUser {
  id: number;
  username: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  registered_date: string;
  roles: string[];
  meta: Record<string, unknown>;
}

type TrackerCheckResult = {
  ok: boolean;
  detail: string;
};

export async function getWPUser(
  userId: number,
  config: WPClientConfig = getDefaultConfig()
): Promise<WPUser | null> {
  const response = await fetch(
    `${config.wordpressRestApiUrl}/users/${userId}?context=edit`,
    {
      headers: { Authorization: getAuthHeader(config) },
    }
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`WP REST API error: ${response.status}`);
  }

  return response.json();
}

export async function getWPUsers(
  perPage = 100,
  page = 1,
  config: WPClientConfig = getDefaultConfig()
): Promise<WPUser[]> {
  const response = await fetch(
    `${config.wordpressRestApiUrl}/users?context=edit&per_page=${perPage}&page=${page}`,
    {
      headers: { Authorization: getAuthHeader(config) },
    }
  );

  if (!response.ok) {
    throw new Error(`WP REST API error: ${response.status}`);
  }

  return response.json();
}

export async function checkOnboardingTrackerSupport(
  config: WPClientConfig = getDefaultConfig()
): Promise<TrackerCheckResult> {
  const response = await fetch(`${config.wordpressRestApiUrl}/users/me?context=edit`, {
    headers: { Authorization: getAuthHeader(config) },
  });

  if (!response.ok) {
    throw new Error(`WP REST API error: ${response.status}`);
  }

  const user = (await response.json()) as WPUser;
  const meta = user.meta && typeof user.meta === "object" ? user.meta : {};
  const hasPasswordMeta = Object.prototype.hasOwnProperty.call(
    meta,
    "last_password_change"
  );
  const hasLoginMeta = Object.prototype.hasOwnProperty.call(meta, "last_login_at");

  if (hasPasswordMeta && hasLoginMeta) {
    return {
      ok: true,
      detail:
        "Onboarding tracker meta is exposed in WordPress REST API. The mu-plugin appears to be installed.",
    };
  }

  return {
    ok: false,
    detail:
      "Onboarding tracker meta was not found in WordPress REST API. Install wordpress/password-change-tracker.php in wp-content/mu-plugins on the managed site before relying on login/password tracking.",
  };
}

async function getCurrentWPUserId(
  config: WPClientConfig
): Promise<number | null> {
  const response = await fetch(
    `${config.wordpressRestApiUrl}/users/me?context=edit`,
    {
      headers: { Authorization: getAuthHeader(config) },
    }
  );
  if (!response.ok) return null;

  const data = (await response.json()) as { id?: number };
  return typeof data.id === "number" ? data.id : null;
}

async function resolveReassignUserId(
  deletingUserId: number,
  config: WPClientConfig
): Promise<number | null> {
  if (config.reassignUserId) {
    const parsed = parseInt(config.reassignUserId, 10);
    if (!Number.isNaN(parsed) && parsed !== deletingUserId) return parsed;
  }

  const adminsResponse = await fetch(
    `${config.wordpressRestApiUrl}/users?context=edit&roles=administrator&per_page=100`,
    {
      headers: { Authorization: getAuthHeader(config) },
    }
  );
  if (adminsResponse.ok) {
    const admins = (await adminsResponse.json()) as Array<{ id: number }>;
    const candidate = admins.find((u) => u.id !== deletingUserId);
    if (candidate?.id) return candidate.id;
  }

  const currentUserId = await getCurrentWPUserId(config);
  if (currentUserId && currentUserId !== deletingUserId) {
    return currentUserId;
  }

  return null;
}

export async function deleteWPUser(
  userId: number,
  config: WPClientConfig = getDefaultConfig()
): Promise<{ deleted: boolean; alreadyMissing: boolean }> {
  const deleteAttempt = async (reassignId?: number) => {
    const query = new URLSearchParams({ force: "true" });
    if (typeof reassignId === "number") {
      query.set("reassign", String(reassignId));
    }
    return fetch(
      `${config.wordpressRestApiUrl}/users/${userId}?${query.toString()}`,
      {
        method: "DELETE",
        headers: { Authorization: getAuthHeader(config) },
      }
    );
  };

  let response = await deleteAttempt();

  if (response.status === 400) {
    let details = "";
    try {
      details = await response.text();
    } catch {
      details = "";
    }

    if (
      details.includes("rest_missing_callback_param") &&
      details.includes("reassign")
    ) {
      const reassignId = await resolveReassignUserId(userId, config);
      if (!reassignId) {
        throw new Error(
          "WP delete user failed: reassign is required but no suitable reassign user could be resolved. Set WORDPRESS_REASSIGN_USER_ID."
        );
      }
      response = await deleteAttempt(reassignId);
    } else {
      throw new Error(`WP delete user failed (400): ${details}`);
    }
  }

  if (response.status === 404) {
    return { deleted: false, alreadyMissing: true };
  }

  if (!response.ok) {
    let details = "";
    try {
      details = await response.text();
    } catch {
      details = "";
    }
    throw new Error(
      `WP delete user failed (${response.status})${details ? `: ${details}` : ""}`
    );
  }

  return { deleted: true, alreadyMissing: false };
}

export async function getPasswordChangeTimestamp(
  userId: number,
  config: WPClientConfig = getDefaultConfig()
): Promise<string | null> {
  const user = await getWPUser(userId, config);
  if (!user) return null;

  const lastChange = user.meta?.last_password_change;
  if (typeof lastChange === "string" && lastChange.trim().length > 0) {
    return lastChange;
  }

  return null;
}

export async function getLoginTimestamp(
  userId: number,
  config: WPClientConfig = getDefaultConfig()
): Promise<string | null> {
  const user = await getWPUser(userId, config);
  if (!user) return null;

  const lastLogin = user.meta?.last_login_at;
  if (typeof lastLogin === "string" && lastLogin.trim().length > 0) {
    return lastLogin;
  }

  return null;
}

function parseWpTimestamp(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoParsed = new Date(trimmed);
  if (!Number.isNaN(isoParsed.getTime())) {
    return isoParsed;
  }

  const legacy = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
  );
  if (!legacy) return null;

  const [, y, m, d, h, min, s] = legacy;
  const utcMs = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(h),
    Number(min),
    Number(s)
  );
  return new Date(utcMs);
}

export function parseWpTimestampSafe(value: string): Date | null {
  return parseWpTimestamp(value);
}

export async function hasPasswordChanged(
  userId: number,
  afterDate: string,
  config: WPClientConfig = getDefaultConfig()
): Promise<boolean> {
  const changeTimestamp = await getPasswordChangeTimestamp(userId, config);
  if (!changeTimestamp) return false;

  const changeDate = parseWpTimestamp(changeTimestamp);
  if (!changeDate) return false;

  return changeDate > new Date(afterDate);
}
