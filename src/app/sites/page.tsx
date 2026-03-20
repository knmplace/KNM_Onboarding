"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type SiteSummary = {
  id: number;
  slug: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  accountLoginUrl: string | null;
  wordpressUrl: string | null;
  wordpressRestApiUrl: string | null;
  profilegridApiUrl: string | null;
  emailFooterImageUrl: string | null;
  supportEmail: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  n8nSyncWorkflowId: string | null;
  n8nReminderWorkflowId: string | null;
  userCount: number;
  secretsConfigured: {
    wordpressAppPassword: boolean;
    profilegridAppPassword: boolean;
    smtpPassword: boolean;
    machineKey: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

type ConnectionResults = Record<
  string,
  {
    ok: boolean;
    detail: string;
  }
>;

type SiteFormState = {
  name: string;
  siteUrl: string;
  slug: string;
  wordpressUsername: string;
  wordpressAppPassword: string;
  supportEmail: string;
  accountLoginUrl: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  smtpFromEmail: string;
  smtpFromName: string;
  emailFooterImageUrl: string;
  breachResearchUrl: string;
};

type CreatedBranding = {
  detectedName: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
} | null;

const initialForm: SiteFormState = {
  name: "",
  siteUrl: "",
  slug: "",
  wordpressUsername: "",
  wordpressAppPassword: "",
  supportEmail: "",
  accountLoginUrl: "",
  smtpHost: "",
  smtpPort: "",
  smtpSecure: true,
  smtpUsername: "",
  smtpPassword: "",
  smtpFromEmail: "",
  smtpFromName: "",
  emailFooterImageUrl: "",
  breachResearchUrl: "https://haveibeenpwned.com",
};

function slugifySiteName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function normalizeUrl(value: string): string {
  try {
    return new URL(value.trim()).toString().replace(/\/$/, "");
  } catch {
    return value.trim();
  }
}

function secretSummary(site: SiteSummary): string {
  const labels: Record<string, string> = {
    wordpressAppPassword: "WordPress app password",
    profilegridAppPassword: "ProfileGrid app password",
    smtpPassword: "SMTP password",
    machineKey: "Machine key",
  };
  const configured = Object.entries(site.secretsConfigured)
    .filter(([, value]) => value)
    .map(([key]) => labels[key] || key);
  return configured.length > 0 ? configured.join(", ") : "None yet";
}

export default function SitesPage() {
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [branding, setBranding] = useState<CreatedBranding>(null);
  const [form, setForm] = useState<SiteFormState>(initialForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [testingSiteId, setTestingSiteId] = useState<number | null>(null);
  const [testingDraftSmtp, setTestingDraftSmtp] = useState(false);
  const [connectionResults, setConnectionResults] = useState<
    Record<number, ConnectionResults>
  >({});

  const derived = useMemo(() => {
    const siteUrl = form.siteUrl ? normalizeUrl(form.siteUrl) : "";
    return {
      slug: slugTouched ? form.slug : slugifySiteName(form.name),
      wordpressUrl: siteUrl,
      wordpressRestApiUrl: siteUrl ? `${siteUrl}/wp-json/wp/v2` : "",
      profilegridApiUrl: siteUrl ? `${siteUrl}/wp-json/profilegrid/v1` : "",
      accountLoginUrl: form.accountLoginUrl || (siteUrl ? `${siteUrl}/login` : ""),
    };
  }, [form.accountLoginUrl, form.name, form.siteUrl, form.slug, slugTouched]);

  async function fetchSites() {
    try {
      setError(null);
      const res = await fetch("/api/sites");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load sites");
      }
      setSites(data.sites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSites();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    setBranding(null);

    try {
      const isEditing = editingSiteId !== null;
      const res = await fetch(isEditing ? `/api/sites/${editingSiteId}` : "/api/sites", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slug: derived.slug,
          smtpPort: form.smtpPort ? Number.parseInt(form.smtpPort, 10) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create site");
      }
      setNotice(
        isEditing ? `Updated site ${data.site.name}.` : `Created site ${data.site.name}.`
      );
      setBranding(data.branding ?? null);
      setForm(initialForm);
      setSlugTouched(false);
      setEditingSiteId(null);
      await fetchSites();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingSiteId !== null
            ? "Failed to update site"
            : "Failed to create site"
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(site: SiteSummary) {
    setEditingSiteId(site.id);
    setBranding(null);
    setNotice(null);
    setError(null);
    setSlugTouched(true);
    setForm({
      name: site.name,
      siteUrl: site.wordpressUrl || "",
      slug: site.slug,
      wordpressUsername: "",
      wordpressAppPassword: "",
      supportEmail: site.supportEmail || "",
      accountLoginUrl: site.accountLoginUrl || "",
      smtpHost: "",
      smtpPort: "",
      smtpSecure: true,
      smtpUsername: "",
      smtpPassword: "",
      smtpFromEmail: site.smtpFromEmail || "",
      smtpFromName: site.smtpFromName || "",
      emailFooterImageUrl: site.emailFooterImageUrl || "",
      breachResearchUrl: "https://haveibeenpwned.com",
    });
  }

  function cancelEdit() {
    setEditingSiteId(null);
    setSlugTouched(false);
    setBranding(null);
    setForm(initialForm);
  }

  async function runDraftSmtpTest() {
    setTestingDraftSmtp(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/sites/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: form.smtpHost,
          smtpPort: form.smtpPort ? Number.parseInt(form.smtpPort, 10) : undefined,
          smtpSecure: form.smtpSecure,
          smtpUsername: form.smtpUsername,
          smtpPassword: form.smtpPassword,
          smtpFromEmail: form.smtpFromEmail,
          smtpFromName: form.smtpFromName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "SMTP test failed");
      }

      setNotice(data.result?.detail || "SMTP connected successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "SMTP test failed");
    } finally {
      setTestingDraftSmtp(false);
    }
  }

  async function runConnectionTests(siteId: number) {
    setTestingSiteId(siteId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/connections`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Connection tests failed");
      }
      setConnectionResults((prev) => ({
        ...prev,
        [siteId]: data.results,
      }));
      setNotice(`Connection tests complete for ${data.site.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection tests failed");
    } finally {
      setTestingSiteId(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sites</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your connected sites. The first site is set as the default during deployment.
          </p>
        </div>
        <Link
          href="/"
          className="px-3 py-1.5 bg-white border border-gray-300 text-sm rounded hover:bg-gray-50"
        >
          Back to Dashboard
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded">
          {notice}
        </div>
      )}
      {branding && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded">
          <div className="font-medium">Branding discovered during site creation</div>
          <div className="mt-1">Detected name: {branding.detectedName || "Not found"}</div>
          <div>Logo URL: {branding.logoUrl || "Not found"}</div>
          <div>Icon URL: {branding.iconUrl || "Not found"}</div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold">Configured Sites</h2>
          </div>
          {loading ? (
            <div className="p-5 text-sm text-gray-500">Loading sites...</div>
          ) : sites.length === 0 ? (
            <div className="p-5 text-sm text-gray-500">No sites configured yet.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sites.map((site) => (
                <div key={site.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{site.name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                          {site.slug}
                        </span>
                        {site.isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {site.isActive ? "Active" : "Inactive"} • {site.userCount} linked users
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(site)}
                      className="px-3 py-1.5 bg-white border border-gray-300 text-sm rounded hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => runConnectionTests(site.id)}
                      disabled={testingSiteId === site.id}
                      className="px-3 py-1.5 bg-white border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      {testingSiteId === site.id ? "Testing..." : "Test Connections"}
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
                    <div>
                      <div className="text-gray-500">WordPress URL</div>
                      <div className="break-all">{site.wordpressUrl || "Not set"}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Login URL</div>
                      <div className="break-all">{site.accountLoginUrl || "Not set"}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">ProfileGrid API</div>
                      <div className="break-all">{site.profilegridApiUrl || "Not set"}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Support Email</div>
                      <div>{site.supportEmail || "Not set"}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Branding Asset</div>
                      <div className="break-all">{site.emailFooterImageUrl || "Not found"}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Credentials Configured</div>
                      <div>{secretSummary(site)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Sync Workflow ID</div>
                      <div className="break-all">{site.n8nSyncWorkflowId || "Not linked yet"}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Reminder Workflow ID</div>
                      <div className="break-all">{site.n8nReminderWorkflowId || "Not linked yet"}</div>
                    </div>
                  </div>
                  {connectionResults[site.id] && (
                    <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                      <div className="font-medium mb-2">Latest Connection Test</div>
                      {Object.entries(connectionResults[site.id]).map(([key, result]) => (
                        <div key={key} className="mb-1 last:mb-0">
                          <span className={result.ok ? "text-green-700" : "text-red-700"}>
                            {result.ok ? "PASS" : "FAIL"}
                          </span>{" "}
                          <strong className="uppercase">{key}</strong>: {result.detail}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold">
              {editingSiteId !== null ? "Edit Site" : "Add New Site"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Start with the website basics. The app will derive the WordPress/ProfileGrid URLs and
              try to pull branding metadata from the site automatically.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm">
                <div className="text-gray-600 mb-1">Site Name</div>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="text-gray-600 mb-1">Site URL</div>
                <input
                  value={form.siteUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, siteUrl: e.target.value }))}
                  placeholder="https://example.com"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm">
                <div className="text-gray-600 mb-1">Slug</div>
                <input
                  value={slugTouched ? form.slug : derived.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((prev) => ({ ...prev, slug: e.target.value }));
                  }}
                  placeholder="auto-generated from site name"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <div className="text-gray-600 mb-1">Support Email</div>
                <input
                  value={form.supportEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, supportEmail: e.target.value }))}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm">
                <div className="text-gray-600 mb-1">WordPress Username</div>
                <input
                  value={form.wordpressUsername}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, wordpressUsername: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="text-gray-600 mb-1">WordPress App Password</div>
                <input
                  type="password"
                  value={form.wordpressAppPassword}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, wordpressAppPassword: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  required
                />
              </label>
            </div>

            <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <div className="font-medium mb-2">Derived from Site URL</div>
              <div>WordPress URL: {derived.wordpressUrl || "Enter a site URL"}</div>
              <div>WP REST API: {derived.wordpressRestApiUrl || "Enter a site URL"}</div>
              <div>ProfileGrid API: {derived.profilegridApiUrl || "Enter a site URL"}</div>
              <div>Account Login URL: {derived.accountLoginUrl || "Enter a site URL"}</div>
            </div>

            <details className="rounded border border-gray-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
                Advanced Overrides
              </summary>
              <div className="px-4 pb-4 space-y-4 border-t border-gray-200">
                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                  <label className="text-sm">
                    <div className="text-gray-600 mb-1">Account Login URL Override</div>
                    <input
                      value={form.accountLoginUrl}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, accountLoginUrl: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm">
                    <div className="text-gray-600 mb-1">SMTP Host</div>
                    <input
                      value={form.smtpHost}
                      onChange={(e) => setForm((prev) => ({ ...prev, smtpHost: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="text-gray-600 mb-1">SMTP Port</div>
                    <input
                      value={form.smtpPort}
                      onChange={(e) => setForm((prev) => ({ ...prev, smtpPort: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm">
                    <div className="text-gray-600 mb-1">SMTP Username</div>
                    <input
                      value={form.smtpUsername}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, smtpUsername: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="text-gray-600 mb-1">SMTP Password</div>
                    <input
                      type="password"
                      value={form.smtpPassword}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, smtpPassword: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm">
                    <div className="text-gray-600 mb-1">SMTP From Email</div>
                    <input
                      value={form.smtpFromEmail}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, smtpFromEmail: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="text-gray-600 mb-1">SMTP From Name</div>
                    <input
                      value={form.smtpFromName}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, smtpFromName: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm">
                    <div className="text-gray-600 mb-1">SMTP Secure</div>
                    <select
                      value={form.smtpSecure ? "true" : "false"}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          smtpSecure: e.target.value === "true",
                        }))
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="text-gray-600 mb-1">Footer Image URL Override</div>
                    <input
                      value={form.emailFooterImageUrl}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          emailFooterImageUrl: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={runDraftSmtpTest}
                    disabled={testingDraftSmtp}
                    className="px-4 py-2 bg-white border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    {testingDraftSmtp ? "Testing SMTP..." : "Test SMTP Before Save"}
                  </button>
                </div>
              </div>
            </details>

            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? editingSiteId !== null
                  ? "Saving Changes..."
                  : "Creating Site..."
                : editingSiteId !== null
                  ? "Save Changes"
                  : "Create Site"}
            </button>
            {editingSiteId !== null && (
              <button
                type="button"
                onClick={cancelEdit}
                className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel Edit
              </button>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
