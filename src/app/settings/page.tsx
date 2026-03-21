"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type SmtpSettings = {
  smtpHost: string;
  smtpPort: string;
  smtpSecure: string;
  smtpUsername: string;
  smtpFromEmail: string;
  smtpFromName: string;
  smtpPasswordSet: boolean;
};

type SmtpPreset = {
  label: string;
  host: string;
  port: string;
  secure: string;
  note?: string;
};

const SMTP_PRESETS: SmtpPreset[] = [
  { label: "Gmail", host: "smtp.gmail.com", port: "465", secure: "true", note: "Use an App Password, not your Google account password." },
  { label: "Gmail (STARTTLS)", host: "smtp.gmail.com", port: "587", secure: "false", note: "Use an App Password." },
  { label: "Outlook / Office 365", host: "smtp.office365.com", port: "587", secure: "false" },
  { label: "Outlook.com / Hotmail", host: "smtp-mail.outlook.com", port: "587", secure: "false" },
  { label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: "465", secure: "true", note: "Use an App Password." },
  { label: "SendGrid", host: "smtp.sendgrid.net", port: "465", secure: "true", note: "Username is always 'apikey'. Password is your API key." },
  { label: "Mailgun", host: "smtp.mailgun.org", port: "465", secure: "true" },
  { label: "Amazon SES (US East)", host: "email-smtp.us-east-1.amazonaws.com", port: "465", secure: "true" },
  { label: "Brevo (Sendinblue)", host: "smtp-relay.brevo.com", port: "587", secure: "false" },
  { label: "Postmark", host: "smtp.postmarkapp.com", port: "587", secure: "false" },
  { label: "Custom / Other", host: "", port: "465", secure: "true" },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [presetNote, setPresetNote] = useState("");

  const [form, setForm] = useState({
    smtpHost: "",
    smtpPort: "465",
    smtpSecure: "true",
    smtpUsername: "",
    smtpPassword: "",
    smtpFromEmail: "",
    smtpFromName: "",
  });
  const [passwordSet, setPasswordSet] = useState(false);

  useEffect(() => {
    fetch("/api/settings/smtp")
      .then((r) => r.json())
      .then((data: SmtpSettings) => {
        setForm({
          smtpHost: data.smtpHost,
          smtpPort: data.smtpPort,
          smtpSecure: data.smtpSecure,
          smtpUsername: data.smtpUsername,
          smtpPassword: "",
          smtpFromEmail: data.smtpFromEmail,
          smtpFromName: data.smtpFromName,
        });
        setPasswordSet(data.smtpPasswordSet);
      })
      .catch(() => setError("Failed to load SMTP settings."))
      .finally(() => setLoading(false));
  }, []);

  function applyPreset(label: string) {
    const preset = SMTP_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    setSelectedPreset(label);
    setPresetNote(preset.note || "");
    setForm((prev) => ({
      ...prev,
      smtpHost: preset.host,
      smtpPort: preset.port,
      smtpSecure: preset.secure,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/smtp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setNotice("SMTP settings saved. Restart the app for changes to take effect.");
      if (form.smtpPassword) setPasswordSet(true);
      setForm((prev) => ({ ...prev, smtpPassword: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/sites/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: form.smtpHost,
          smtpPort: Number.parseInt(form.smtpPort, 10) || undefined,
          smtpSecure: form.smtpSecure === "true",
          smtpUsername: form.smtpUsername,
          smtpPassword: form.smtpPassword || undefined,
          smtpFromEmail: form.smtpFromEmail,
          smtpFromName: form.smtpFromName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "SMTP test failed.");
      setNotice(data.result?.detail || "SMTP connected successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "SMTP test failed.");
    } finally {
      setTesting(false);
    }
  }

  const inputClass = "theme-input px-3 py-2 text-sm w-full";
  const labelClass = "block text-sm theme-text-muted mb-1";

  return (
    <main className="page-shell">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm theme-text-muted mt-1">
            Application-level configuration. SMTP here is the default for all sites.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="theme-button theme-button--ghost px-3 py-1.5 text-sm">
            Back to Dashboard
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {error && <div className="theme-alert theme-alert--error mb-4">{error}</div>}
      {notice && <div className="theme-alert theme-alert--success mb-4">{notice}</div>}

      {loading ? (
        <div className="theme-card p-6 text-sm theme-text-muted">Loading settings...</div>
      ) : (
        <form onSubmit={handleSave} className="theme-card p-6 space-y-6 max-w-2xl">
          <div>
            <h2 className="font-semibold mb-1">Default SMTP</h2>
            <p className="text-xs theme-text-muted">
              Used by all sites unless a site has its own SMTP configured. Saved to{" "}
              <code className="px-1 rounded" style={{ background: "var(--panel-strong)" }}>
                .env.local
              </code>
              . The app must restart for changes to take effect.
            </p>
          </div>

          {/* Provider preset picker */}
          <div>
            <label className={labelClass}>Provider Preset</label>
            <select
              value={selectedPreset}
              onChange={(e) => applyPreset(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select a provider to pre-fill settings —</option>
              {SMTP_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
            {presetNote && (
              <p className="mt-1 text-xs" style={{ color: "var(--warning-text, #92400e)" }}>
                {presetNote}
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>SMTP Host</label>
              <input
                type="text"
                value={form.smtpHost}
                onChange={(e) => setForm((p) => ({ ...p, smtpHost: e.target.value }))}
                placeholder="smtp.gmail.com"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Port</label>
                <input
                  type="text"
                  value={form.smtpPort}
                  onChange={(e) => setForm((p) => ({ ...p, smtpPort: e.target.value }))}
                  placeholder="465"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Secure (SSL)</label>
                <select
                  value={form.smtpSecure}
                  onChange={(e) => setForm((p) => ({ ...p, smtpSecure: e.target.value }))}
                  className={inputClass}
                >
                  <option value="true">Yes (SSL/TLS)</option>
                  <option value="false">No (STARTTLS)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>SMTP Username</label>
              <input
                type="text"
                value={form.smtpUsername}
                onChange={(e) => setForm((p) => ({ ...p, smtpUsername: e.target.value }))}
                placeholder="you@yourdomain.com"
                className={inputClass}
                autoComplete="username"
              />
            </div>
            <div>
              <label className={labelClass}>
                SMTP Password{" "}
                {passwordSet && (
                  <span className="text-xs theme-text-soft">(currently set — leave blank to keep)</span>
                )}
              </label>
              <input
                type="password"
                value={form.smtpPassword}
                onChange={(e) => setForm((p) => ({ ...p, smtpPassword: e.target.value }))}
                placeholder={passwordSet ? "Leave blank to keep current" : "Enter password"}
                className={inputClass}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>From Email</label>
              <input
                type="email"
                value={form.smtpFromEmail}
                onChange={(e) => setForm((p) => ({ ...p, smtpFromEmail: e.target.value }))}
                placeholder="onboarding@yourdomain.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>From Name <span className="text-xs theme-text-soft">(optional)</span></label>
              <input
                type="text"
                value={form.smtpFromName}
                onChange={(e) => setForm((p) => ({ ...p, smtpFromName: e.target.value }))}
                placeholder="My Company Onboarding"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              type="submit"
              disabled={saving}
              className="theme-button theme-button--primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save SMTP Settings"}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="theme-button theme-button--ghost px-4 py-2 text-sm disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
