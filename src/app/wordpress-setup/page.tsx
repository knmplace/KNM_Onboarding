"use client";

import { useState } from "react";
import Link from "next/link";
import { PLUGIN_PHP, PLUGIN_SLUG } from "@/lib/plugin-source";

export default function WordPressSetupPage() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(PLUGIN_PHP).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main className="page-shell max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="theme-button theme-button--ghost px-3 py-1.5 text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold">KNM Onboarding Helper</h1>
      </div>

      <p className="text-sm theme-text-muted mb-6">
        The KNM Onboarding Helper is a small WordPress plugin required for password-change
        and login-activity tracking. Without it, users will not automatically advance through
        the onboarding steps.
      </p>

      {/* ── Method 1: Auto-install (recommended) ── */}
      <section className="theme-card mb-6 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white" style={{ background: "var(--accent)" }}>1</span>
          <h2 className="font-semibold">Auto-Install from Sites Page <span className="text-xs theme-text-soft font-normal ml-1">(recommended)</span></h2>
        </div>
        <div className="px-5 py-4 text-sm space-y-2">
          <p className="theme-text-muted">
            The easiest option. Run a <strong>Test Connections</strong> check on your site from the{" "}
            <Link href="/sites" className="underline" style={{ color: "var(--accent)" }}>Sites page</Link>.
            If the plugin is not detected, an <strong>Install Plugin</strong> button will appear — click it
            and ADOB will upload and activate the plugin automatically using your WordPress credentials.
          </p>
          <div className="rounded border px-4 py-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--panel-muted)" }}>
            <strong>Requirement:</strong> The WordPress user configured in your site must have{" "}
            <strong>Administrator</strong> role. Editors and Authors cannot install plugins.
          </div>
        </div>
      </section>

      {/* ── Method 2: Upload via WP Admin ── */}
      <section className="theme-card mb-6 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white" style={{ background: "var(--accent)" }}>2</span>
          <h2 className="font-semibold">Upload via WordPress Admin</h2>
        </div>
        <div className="px-5 py-4 text-sm space-y-3">
          <ol className="space-y-2 theme-text-muted list-decimal list-inside">
            <li>Download the plugin ZIP below.</li>
            <li>In WordPress Admin, go to <strong>Plugins → Add New → Upload Plugin</strong>.</li>
            <li>Choose the downloaded ZIP file and click <strong>Install Now</strong>.</li>
            <li>Click <strong>Activate Plugin</strong> after install completes.</li>
          </ol>
          <a
            href="/api/wordpress-setup/download?format=zip"
            className="theme-button theme-button--primary inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            ↓ Download Plugin ZIP
          </a>
          <p className="text-xs theme-text-soft">
            Installs to <code className="px-1 rounded" style={{ background: "var(--panel)" }}>wp-content/plugins/{PLUGIN_SLUG}/</code> and appears in your Plugins list.
          </p>
        </div>
      </section>

      {/* ── Method 3: Manual mu-plugins ── */}
      <section className="theme-card mb-6 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white" style={{ background: "var(--accent)" }}>3</span>
          <h2 className="font-semibold">Manual Install <span className="text-xs theme-text-soft font-normal ml-1">(advanced — server access required)</span></h2>
        </div>
        <div className="px-5 py-4 text-sm space-y-3">
          <p className="theme-text-muted">
            Copy the raw PHP file directly into <code className="px-1 rounded" style={{ background: "var(--panel)" }}>wp-content/mu-plugins/</code> on your WordPress server.
            mu-plugins load automatically and cannot be deactivated — the most reliable option if you have server access.
          </p>
          <ol className="space-y-2 theme-text-muted list-decimal list-inside">
            <li>Download or copy the PHP file below.</li>
            <li>
              Place it at: <code className="px-1 rounded text-xs" style={{ background: "var(--panel)" }}>wp-content/mu-plugins/knm-onboarding-helper.php</code>
            </li>
            <li>No activation needed — it loads automatically.</li>
          </ol>
          <div className="flex gap-2 flex-wrap">
            <a
              href="/api/wordpress-setup/download?format=php"
              className="theme-button theme-button--ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              ↓ Download .php File
            </a>
            <button
              onClick={handleCopy}
              className="theme-button theme-button--ghost px-4 py-2 text-sm"
            >
              {copied ? "Copied!" : "Copy Code"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Code viewer ── */}
      <section className="theme-card overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm font-medium">knm-onboarding-helper.php</span>
          <button onClick={handleCopy} className="theme-button theme-button--ghost px-3 py-1 text-xs">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre
          className="text-xs p-5 overflow-x-auto leading-relaxed"
          style={{ background: "var(--panel)", color: "var(--text)" }}
        >
          {PLUGIN_PHP}
        </pre>
      </section>
    </main>
  );
}
