/**
 * ProfileGrid API Client for WordPress
 * Compatible with ProfileGrid WordPress plugin (profilegrid.com).
 *
 * Token endpoint:      POST /wp-json/profilegrid/v1/token
 * Integration endpoint: GET/POST /wp-json/profilegrid/v1/integration?integration=1&action=<action>
 * Auth header:         Authorization: Bearer <token>
 */

export interface ProfileGridUser {
  id: number;
  user_login: string;
  display_name: string;
  email: string;
  roles: string[];
  status: string; // "0"=active, "1"=inactive
  groups: number[];
  avatar: string;
  profile_url: string;
  user_registered?: string;
}

export interface ProfileGridClientConfig {
  profilegridApiUrl: string;
  username: string;
  applicationPassword: string;
  cacheKey?: string;
}

type TokenCacheEntry = {
  token: string;
  expiresAt: number;
};

const tokenCache = new Map<string, TokenCacheEntry>();

function getDefaultConfig(): ProfileGridClientConfig {
  return {
    profilegridApiUrl: process.env.PROFILEGRID_API_URL!,
    username: process.env.WORDPRESS_USERNAME!,
    applicationPassword: process.env.WORDPRESS_APP_PASSWORD!,
    cacheKey: "default",
  };
}

function getCacheKey(config: ProfileGridClientConfig): string {
  return config.cacheKey || `${config.profilegridApiUrl}|${config.username}`;
}

async function getToken(config: ProfileGridClientConfig): Promise<string> {
  const cacheKey = getCacheKey(config);
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const response = await fetch(`${config.profilegridApiUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: config.username,
      application_password: config.applicationPassword,
    }),
  });

  if (!response.ok) {
    throw new Error(`ProfileGrid token error: ${response.status}`);
  }

  const data = await response.json();
  const token = data.token;
  if (!token) {
    throw new Error("No token returned from ProfileGrid");
  }

  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  });

  return token;
}

async function pgFetch(
  config: ProfileGridClientConfig,
  action: string,
  params?: Record<string, string>
) {
  const token = await getToken(config);
  const queryParams = new URLSearchParams({
    integration: "1",
    action,
    ...params,
  });

  const response = await fetch(
    `${config.profilegridApiUrl}/integration?${queryParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error(`ProfileGrid API error: ${response.status} for ${action}`);
  }

  return response.json();
}

type GetUsersOptions = {
  perPage?: number;
  maxPages?: number;
};

async function pgPost(
  config: ProfileGridClientConfig,
  action: string,
  body: Record<string, string>
) {
  const token = await getToken(config);
  const response = await fetch(
    `${config.profilegridApiUrl}/integration?integration=1&action=${action}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    let details = "";
    try {
      details = await response.text();
    } catch {
      details = "";
    }
    throw new Error(
      `ProfileGrid action '${action}' failed (${response.status})${
        details ? `: ${details}` : ""
      }`
    );
  }

  return response.json();
}

export async function getUsers(
  config: ProfileGridClientConfig = getDefaultConfig(),
  options: GetUsersOptions = {}
): Promise<ProfileGridUser[]> {
  const perPage = options.perPage ?? 100;
  const maxPages = options.maxPages ?? 25;
  const usersById = new Map<number, ProfileGridUser>();

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await pgFetch(config, "get_users", {
      page: String(page),
      per_page: String(perPage),
    });
    const pageUsers = (result.data || result || []) as ProfileGridUser[];

    if (!Array.isArray(pageUsers) || pageUsers.length === 0) {
      break;
    }

    let newRecords = 0;
    for (const user of pageUsers) {
      if (!usersById.has(user.id)) {
        newRecords += 1;
      }
      usersById.set(user.id, user);
    }

    if (pageUsers.length < perPage || newRecords === 0) {
      break;
    }
  }

  return Array.from(usersById.values());
}

export async function getUserDetails(
  userId: string,
  config: ProfileGridClientConfig = getDefaultConfig()
): Promise<ProfileGridUser | null> {
  const data = await pgFetch(config, "get_user_details", { user_id: userId });
  return data || null;
}

export async function getMembershipRequests(
  config: ProfileGridClientConfig = getDefaultConfig()
) {
  return pgFetch(config, "get_membership_requests");
}

export async function activateUser(
  userId: string,
  config: ProfileGridClientConfig = getDefaultConfig()
) {
  return pgPost(config, "activate_user_account", { user_id: userId });
}

export async function deactivateUser(
  userId: string,
  config: ProfileGridClientConfig = getDefaultConfig()
) {
  return pgPost(config, "deactivate_user_account", { user_id: userId });
}

export async function deleteUser(
  userId: string,
  config: ProfileGridClientConfig = getDefaultConfig()
) {
  const actions = ["delete_user", "delete_user_account", "remove_user"];
  const errors: string[] = [];

  for (const action of actions) {
    try {
      return await pgPost(config, action, { user_id: userId });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    `ProfileGrid delete failed for user ${userId}. Tried actions: ${actions.join(
      ", "
    )}. Errors: ${errors.join(" | ")}`
  );
}
