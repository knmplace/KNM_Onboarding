"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

// ── Types ─────────────────────────────────────────────────────────────────────

type SmtpServer = {
  id: number;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string | null;
  isDefault: boolean;
  createdAt: string;
  sites: { id: number; name: string; slug: string }[];
};

type ServerForm = {
  label: string;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
};

// ── Provider presets ───────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Gmail (SSL/TLS — port 465)", host: "smtp.gmail.com", port: "465", secure: true, note: "Use an App Password, not your Google account password." },
  { label: "Gmail (STARTTLS — port 587)", host: "smtp.gmail.com", port: "587", secure: false, note: "Use an App Password." },
  { label: "Outlook / Office 365", host: "smtp.office365.com", port: "587", secure: false },
  { label: "Outlook.com / Hotmail", host: "smtp-mail.outlook.com", port: "587", secure: false },
  { label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: "465", secure: true, note: "Use an App Password." },
  { label: "SendGrid", host: "smtp.sendgrid.net", port: "465", secure: true, note: "Username is always 'apikey'. Password is your SendGrid API key." },
  { label: "Mailgun", host: "smtp.mailgun.org", port: "465", secure: true },
  { label: "Amazon SES (US East)", host: "email-smtp.us-east-1.amazonaws.com", port: "465", secure: true },
  { label: "Brevo (Sendinblue)", host: "smtp-relay.brevo.com", port: "587", secure: false },
  { label: "Postmark", host: "smtp.postmarkapp.com", port: "587", secure: false },
  { label: "Custom / Other", host: "", port: "465", secure: true },
];

const emptyServerForm = (): ServerForm => ({
  label: "", host: "", port: "465", secure: true,
  username: "", password: "", fromEmail: "", fromName: "",
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // SMTP library state
  const [servers, setServers] = useState<SmtpServer[]>([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [serverForm, setServerForm] = useState<ServerForm>(emptyServerForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [serverSaving, setServerSaving] = useState(false);
  const [serverTesting, setServerTesting] = useState(false);
  const [presetNote, setPresetNote] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);

  // Abstract API state
  const [abstractApiKey, setAbstractApiKey] = useState("");
  const [abstractConfigured, setAbstractConfigured] = useState(false);
  const [abstractSaving, setAbstractSaving] = useState(false);

  // Shared notices
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Load Abstract API status ─────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings/abstract-api")
      .then((r) => r.json())
      .then((d) => setAbstractConfigured(!!d.configured))
      .catch(() => {});
  }, []);

  async function handleSaveAbstractKey(e: React.FormEvent) {
    e.preventDefault();
    setAbstractSaving(true);
    setError(null); setNotice(null);
    try {
      const res = await fetch("/api/settings/abstract-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: abstractApiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setAbstractConfigured(true);
      setAbstractApiKey("");
      setNotice("Abstract API key saved. Email validation is now active.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setAbstractSaving(false);
    }
  }

  // ── Load SMTP library ────────────────────────────────────────────────────────
  async function fetchServers() {
    setServersLoading(true);
    try {
      const res = await fetch("/api/smtp-servers");
      const data = await res.json();
      setServers(data.servers ?? []);
    } catch {
      setError("Failed to load SMTP servers.");
    } finally {
      setServersLoading(false);
    }
  }

  useEffect(() => { fetchServers(); }, []);

  // ── Set default handler ──────────────────────────────────────────────────────
  async function setDefaultServer(id: number, label: string) {
    setSettingDefaultId(id);
    setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/smtp-servers/${id}/set-default`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set default.");
      setNotice(`"${label}" is now the app default SMTP server. No restart needed.`);
      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set default.");
    } finally {
      setSettingDefaultId(null);
    }
  }

  // ── Library server handlers ──────────────────────────────────────────────────
  function applyPreset(label: string) {
    const p = PRESETS.find((x) => x.label === label);
    if (!p) return;
    setPresetNote(p.note || "");
    setServerForm((prev) => ({ ...prev, host: p.host, port: String(p.port), secure: p.secure }));
  }

  function startEdit(s: SmtpServer) {
    setEditingId(s.id);
    setPresetNote("");
    setError(null); setNotice(null);
    setServerForm({
      label: s.label, host: s.host, port: String(s.port),
      secure: s.secure, username: s.username, password: "",
      fromEmail: s.fromEmail, fromName: s.fromName || "",
    });
    window.scrollTo({ top: document.getElementById("smtp-library-form")?.offsetTop ?? 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setPresetNote("");
    setServerForm(emptyServerForm());
  }

  async function saveServer(e: React.FormEvent) {
    e.preventDefault();
    setServerSaving(true);
    setError(null); setNotice(null);
    try {
      const url = editingId ? `/api/smtp-servers/${editingId}` : "/api/smtp-servers";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...serverForm, port: Number(serverForm.port) || 465 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setNotice(editingId ? `Updated "${data.server.label}".` : `Added "${data.server.label}" to library.`);
      setEditingId(null);
      setServerForm(emptyServerForm());
      setPresetNote("");
      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setServerSaving(false);
    }
  }

  async function testServer() {
    setServerTesting(true);
    setError(null); setNotice(null);
    try {
      const res = await fetch("/api/sites/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: serverForm.host,
          smtpPort: Number(serverForm.port) || undefined,
          smtpSecure: serverForm.secure,
          smtpUsername: serverForm.username,
          smtpPassword: serverForm.password || undefined,
          smtpFromEmail: serverForm.fromEmail,
          smtpFromName: serverForm.fromName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "SMTP test failed.");
      setNotice(data.result?.detail || "Connected successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "SMTP test failed.");
    } finally {
      setServerTesting(false);
    }
  }

  async function deleteServer(id: number, label: string) {
    if (!confirm(`Remove "${label}" from the library? Sites using it will keep their current SMTP settings but lose the library link.`)) return;
    setDeletingId(id);
    setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/smtp-servers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete.");
      setNotice(`Removed "${label}" from library.`);
      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  }

  const inputClass = "theme-input px-3 py-2 text-sm w-full";
  const labelClass = "block text-sm theme-text-muted mb-1";

  return (
    <main className="page-shell">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm theme-text-muted mt-1">App configuration and SMTP server library.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="theme-button theme-button--ghost px-3 py-1.5 text-sm">Back to Dashboard</Link>
          <ThemeToggle />
        </div>
      </div>

      {error && <div className="theme-alert theme-alert--error mb-4">{error}</div>}
      {notice && <div className="theme-alert theme-alert--success mb-4">{notice}</div>}

      {/* ── App Default SMTP banner ── */}
      {(() => {
        const def = servers.find((s) => s.isDefault);
        return (
          <div className="theme-card p-4 mb-8 max-w-2xl flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-blue-500" style={{ color: "var(--accent)" }}>
                <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 9v5M10 7h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-sm">
              <p className="font-medium mb-0.5">App Default SMTP</p>
              {serversLoading ? (
                <span className="theme-text-muted">Loading...</span>
              ) : def ? (
                <span className="theme-text-muted">
                  Currently using <strong className="theme-text">{def.label}</strong> ({def.host}:{def.port}) as the global fallback for sites without a site-specific SMTP. Changes take effect immediately — no restart needed.
                </span>
              ) : (
                <span className="theme-text-muted">
                  No app default set. Add a server to the library below and click <strong className="theme-text">Set as Default</strong>. Falls back to <code className="px-1 rounded text-xs" style={{ background: "var(--panel-strong)" }}>SMTP_*</code> env vars if present.
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── SMTP Server Library ── */}
      <section>
        <h2 className="text-xl font-semibold mb-1">SMTP Server Library</h2>
        <p className="text-sm theme-text-muted mb-4">
          Save reusable SMTP servers here. Assign them to sites from the Sites page — the server settings are copied to the site automatically.
        </p>

        <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">

          {/* Library list */}
          <div className="theme-card overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">Saved Servers</h3>
            </div>
            {serversLoading ? (
              <div className="p-5 text-sm theme-text-muted">Loading...</div>
            ) : servers.length === 0 ? (
              <div className="p-5 text-sm theme-text-muted">No SMTP servers saved yet. Add one using the form.</div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {servers.map((s) => (
                  <div key={s.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{s.label}</span>
                          {s.isDefault && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <div className="text-xs theme-text-muted mt-0.5">
                          {s.host}:{s.port} · {s.secure ? "SSL/TLS" : "STARTTLS"} · {s.username}
                        </div>
                        <div className="text-xs theme-text-muted">From: {s.fromEmail}{s.fromName ? ` (${s.fromName})` : ""}</div>
                        <div className="text-xs theme-text-soft mt-1">
                          Password: <span className="italic">stored, hidden</span>
                        </div>
                        {s.sites.length > 0 && (
                          <div className="text-xs mt-1" style={{ color: "var(--accent)" }}>
                            Used by: {s.sites.map((x) => x.name).join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0 items-end">
                        {!s.isDefault ? (
                          <button
                            type="button"
                            onClick={() => setDefaultServer(s.id, s.label)}
                            disabled={settingDefaultId === s.id}
                            className="theme-button theme-button--ghost px-2 py-1 text-xs disabled:opacity-50"
                            style={{ color: "var(--accent)" }}
                          >
                            {settingDefaultId === s.id ? "Setting..." : "Set as Default"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              setSettingDefaultId(s.id);
                              setError(null); setNotice(null);
                              try {
                                const res = await fetch(`/api/smtp-servers/${s.id}/set-default`, { method: "DELETE" });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || "Failed to clear default.");
                                setNotice(`"${s.label}" is no longer the app default.`);
                                await fetchServers();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Failed to clear default.");
                              } finally {
                                setSettingDefaultId(null);
                              }
                            }}
                            disabled={settingDefaultId === s.id}
                            className="theme-button theme-button--ghost px-2 py-1 text-xs disabled:opacity-50"
                          >
                            {settingDefaultId === s.id ? "..." : "Clear Default"}
                          </button>
                        )}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => startEdit(s)} className="theme-button theme-button--ghost px-2 py-1 text-xs">Edit</button>
                          <button type="button" onClick={() => deleteServer(s.id, s.label)} disabled={deletingId === s.id} className="theme-button theme-button--ghost px-2 py-1 text-xs text-red-600 disabled:opacity-50">
                            {deletingId === s.id ? "..." : "Remove"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add / Edit form */}
          <div className="theme-card" id="smtp-library-form">
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">{editingId ? "Edit Server" : "Add Server"}</h3>
              <p className="text-xs theme-text-muted mt-0.5">Give it a descriptive label so it's easy to identify.</p>
            </div>
            <form onSubmit={saveServer} className="p-5 space-y-4">
              <div>
                <label className={labelClass}>Label</label>
                <input type="text" value={serverForm.label} onChange={(e) => setServerForm((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Gmail - Main Account" className={inputClass} required />
              </div>

              <div>
                <label className={labelClass}>Provider Preset</label>
                <select value="" onChange={(e) => applyPreset(e.target.value)} className={inputClass}>
                  <option value="">— Select to pre-fill host/port/secure —</option>
                  {PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                </select>
                {presetNote && <p className="mt-1 text-xs" style={{ color: "var(--warning-text, #92400e)" }}>{presetNote}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelClass}>Host</label>
                  <input type="text" value={serverForm.host} onChange={(e) => setServerForm((p) => ({ ...p, host: e.target.value }))} placeholder="smtp.gmail.com" className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Port</label>
                  <input type="text" value={serverForm.port} onChange={(e) => setServerForm((p) => ({ ...p, port: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Secure</label>
                  <select value={serverForm.secure ? "true" : "false"} onChange={(e) => setServerForm((p) => ({ ...p, secure: e.target.value === "true" }))} className={inputClass}>
                    <option value="true">SSL/TLS</option>
                    <option value="false">STARTTLS</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Username</label>
                  <input type="text" value={serverForm.username} onChange={(e) => setServerForm((p) => ({ ...p, username: e.target.value }))} className={inputClass} required autoComplete="username" />
                </div>
                <div>
                  <label className={labelClass}>
                    Password{editingId && <span className="text-xs theme-text-soft ml-1">(leave blank to keep)</span>}
                  </label>
                  <input type="password" value={serverForm.password} onChange={(e) => setServerForm((p) => ({ ...p, password: e.target.value }))} placeholder={editingId ? "Leave blank to keep" : "Required"} className={inputClass} required={!editingId} autoComplete="new-password" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>From Email</label>
                  <input type="email" value={serverForm.fromEmail} onChange={(e) => setServerForm((p) => ({ ...p, fromEmail: e.target.value }))} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>From Name <span className="text-xs theme-text-soft">(optional)</span></label>
                  <input type="text" value={serverForm.fromName} onChange={(e) => setServerForm((p) => ({ ...p, fromName: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <button type="submit" disabled={serverSaving} className="theme-button theme-button--primary px-4 py-2 text-sm disabled:opacity-50">
                  {serverSaving ? "Saving..." : editingId ? "Save Changes" : "Add to Library"}
                </button>
                <button type="button" onClick={testServer} disabled={serverTesting} className="theme-button theme-button--ghost px-4 py-2 text-sm disabled:opacity-50">
                  {serverTesting ? "Testing..." : "Test Connection"}
                </button>
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="theme-button theme-button--ghost px-4 py-2 text-sm">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ── Abstract API ── */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-1">Abstract API — Email Validation</h2>
        <p className="text-sm theme-text-muted mb-4">
          Used to validate email quality and detect disposable addresses during user sync.{" "}
          <a href="https://www.abstractapi.com/api/email-validation-verification-api" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
            Get a free API key
          </a>
          .
        </p>

        <div className="theme-card max-w-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium">Status:</span>
            {abstractConfigured ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: "var(--success-bg, #d1fae5)", color: "var(--success-text, #065f46)" }}>
                ✓ Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: "var(--panel-strong)", color: "var(--text-muted)" }}>
                Not configured
              </span>
            )}
          </div>

          <form onSubmit={handleSaveAbstractKey} className="space-y-4">
            <div>
              <label className={labelClass}>
                API Key{abstractConfigured && <span className="text-xs theme-text-soft ml-1">(enter new key to replace)</span>}
              </label>
              <input
                type="password"
                value={abstractApiKey}
                onChange={(e) => setAbstractApiKey(e.target.value)}
                placeholder={abstractConfigured ? "Enter new key to replace existing" : "Paste your Abstract API key"}
                className={inputClass}
                autoComplete="new-password"
                required
              />
            </div>
            <button type="submit" disabled={abstractSaving} className="theme-button theme-button--primary px-4 py-2 text-sm disabled:opacity-50">
              {abstractSaving ? "Saving..." : "Save API Key"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
