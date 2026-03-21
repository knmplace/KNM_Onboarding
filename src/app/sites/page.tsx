"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

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
  const [connectionResults, setConnectionResults] = useState<Record<number, ConnectionResults>>({});

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
    <main className="page-shell">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sites</h1>
          <p className="text-sm theme-text-muted mt-1">
            Manage your connected sites. The first site is set as the default during deployment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="theme-button theme-button--ghost px-3 py-1.5 text-sm">
            Back to Dashboard
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {error && <div className="theme-alert theme-alert--error">{error}</div>}
      {notice && <div className="theme-alert theme-alert--success">{notice}</div>}
      {branding && (
        <div className="theme-alert theme-alert--info">
          <div className="font-medium">Branding discovered during site creation</div>
          <div className="mt-1">Detected name: {branding.detectedName || "Not found"}</div>
          <div>Logo URL: {branding.logoUrl || "Not found"}</div>
          <div>Icon URL: {branding.iconUrl || "Not found"}</div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="theme-card overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-semibold">Configured Sites</h2>
          </div>
          {loading ? (
            <div className="p-5 text-sm theme-text-muted">Loading sites...</div>
          ) : sites.length === 0 ? (
            <div className="p-5 text-sm theme-text-muted">No sites configured yet.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {sites.map((site) => (
                <div key={site.id} className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
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
                      <p className="text-sm theme-text-muted mt-1">
                        {site.isActive ? "Active" : "Inactive"} - {site.userCount} linked users
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => startEdit(site)}
                        className="theme-button theme-button--ghost px-3 py-1.5 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => runConnectionTests(site.id)}
                        disabled={testingSiteId === site.id}
                        className="theme-button theme-button--ghost px-3 py-1.5 text-sm disabled:opacity-50"
                      >
                        {testingSiteId === site.id ? "Testing..." : "Test Connections"}
                      </button>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
                    <div>
                      <div className="theme-text-muted">WordPress URL</div>
                      <div className="break-all">{site.wordpressUrl || "Not set"}</div>
                    </div>
                    <div>
                      <div className="theme-text-muted">Login URL</div>
                      <div className="break-all">{site.accountLoginUrl || "Not set"}</div>
                    </div>
                    <div>
                      <div className="theme-text-muted">ProfileGrid API</div>
                      <div className="break-all">{site.profilegridApiUrl || "Not set"}</div>
                    </div>
                    <div>
                      <div className="theme-text-muted">Support Email</div>
                      <div>{site.supportEmail || "Not set"}</div>
                    </div>
                    <div>
                      <div className="theme-text-muted">Branding Asset</div>
                      <div className="break-all">{site.emailFooterImageUrl || "Not found"}</div>
                    </div>
                    <div>
                      <div className="theme-text-muted">Credentials Configured</div>
                      <div>{secretSummary(site)}</div>
                    </div>
                    <div>
                      <div className="theme-text-muted">Sync Workflow ID</div>
                      <div className="break-all">{site.n8nSyncWorkflowId || "Not linked yet"}</div>
                    </div>
                    <div>
                      <div className="theme-text-muted">Reminder Workflow ID</div>
                      <div className="break-all">
                        {site.n8nReminderWorkflowId || "Not linked yet"}
                      </div>
                    </div>
                  </div>
                  {connectionResults[site.id] && (
                    <div
                      className="mt-4 rounded border p-3 text-sm"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--panel-muted)",
                      }}
                    >
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

        <section className="theme-card">
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-semibold">
              {editingSiteId !== null ? "Edit Site" : "Add New Site"}
            </h2>
            <p className="text-sm theme-text-muted mt-1">
              Start with the website basics. The app will derive the WordPress/ProfileGrid URLs and
              try to pull branding metadata from the site automatically.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm">
                <div className="theme-text-muted mb-1">Site Name</div>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="theme-input px-3 py-2"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="theme-text-muted mb-1">Site URL</div>
                <input
                  value={form.siteUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, siteUrl: e.target.value }))}
                  placeholder="https://example.com"
                  className="theme-input px-3 py-2"
                  required
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm">
                <div className="theme-text-muted mb-1">Slug</div>
                <input
                  value={slugTouched ? form.slug : derived.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((prev) => ({ ...prev, slug: e.target.value }));
                  }}
                  placeholder="auto-generated from site name"
                  className="theme-input px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <div className="theme-text-muted mb-1">Support Email</div>
                <input
                  value={form.supportEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, supportEmail: e.target.value }))}
                  placeholder="Optional"
                  className="theme-input px-3 py-2"
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm">
                <div className="theme-text-muted mb-1">WordPress Username</div>
                <input
                  value={form.wordpressUsername}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, wordpressUsername: e.target.value }))
                  }
                  className="theme-input px-3 py-2"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="theme-text-muted mb-1">WordPress App Password</div>
                <input
                  type="password"
                  value={form.wordpressAppPassword}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, wordpressAppPassword: e.target.value }))
                  }
                  className="theme-input px-3 py-2"
                  required
                />
              </label>
            </div>

            <div className="theme-alert theme-alert--info">
              <div className="font-medium mb-2">Derived from Site URL</div>
              <div>WordPress URL: {derived.wordpressUrl || "Enter a site URL"}</div>
              <div>WP REST API: {derived.wordpressRestApiUrl || "Enter a site URL"}</div>
              <div>ProfileGrid API: {derived.profilegridApiUrl || "Enter a site URL"}</div>
              <div>Account Login URL: {derived.accountLoginUrl || "Enter a site URL"}</div>
            </div>

            <details className="rounded border" style={{ borderColor: "var(--border)" }}>
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Advanced Overrides
              </summary>
              <div
                className="px-4 pb-4 space-y-4 border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                  <label className="text-sm">
                    <div className="theme-text-muted mb-1">Account Login URL Override</div>
                    <input
                      value={form.accountLoginUrl}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, accountLoginUrl: e.target.value }))
                      }
                      className="theme-input px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm">
                    <div className="theme-text-muted mb-1">SMTP Host</div>
                    <input
                      value={form.smtpHost}
                      onChange={(e) => setForm((prev) => ({ ...prev, smtpHost: e.target.value }))}
                      className="theme-input px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="theme-text-muted mb-1">SMTP Port</div>
                    <input
                      value={form.smtpPort}
                      onChange={(e) => setForm((prev) => ({ ...prev, smtpPort: e.target.value }))}
                      className="theme-input px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm">
                    <div className="theme-text-muted mb-1">SMTP Username</div>
                    <input
                      value={form.smtpUsername}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, smtpUsername: e.target.value }))
                      }
                      className="theme-input px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="theme-text-muted mb-1">SMTP Password</div>
                    <input
                      type="password"
                      value={form.smtpPassword}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, smtpPassword: e.target.value }))
                      }
                      className="theme-input px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm">
                    <div className="theme-text-muted mb-1">SMTP From Email</div>
                    <input
                      value={form.smtpFromEmail}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, smtpFromEmail: e.target.value }))
                      }
                      className="theme-input px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="theme-text-muted mb-1">SMTP From Name</div>
                    <input
                      value={form.smtpFromName}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, smtpFromName: e.target.value }))
                      }
                      className="theme-input px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm">
                    <div className="theme-text-muted mb-1">SMTP Secure</div>
                    <select
                      value={form.smtpSecure ? "true" : "false"}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          smtpSecure: e.target.value === "true",
                        }))
                      }
                      className="theme-select px-3 py-2"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="theme-text-muted mb-1">Footer Image URL Override</div>
                    <input
                      value={form.emailFooterImageUrl}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          emailFooterImageUrl: e.target.value,
                        }))
                      }
                      className="theme-input px-3 py-2"
                    />
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={runDraftSmtpTest}
                    disabled={testingDraftSmtp}
                    className="theme-button theme-button--ghost px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {testingDraftSmtp ? "Testing SMTP..." : "Test SMTP Before Save"}
                  </button>
                </div>
              </div>
            </details>

            <button
              type="submit"
              disabled={saving}
              className="theme-button theme-button--primary w-full px-4 py-2 disabled:opacity-50"
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
                className="theme-button theme-button--ghost w-full px-4 py-2"
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
