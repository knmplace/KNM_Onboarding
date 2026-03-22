"use client";

import { useState } from "react";
import Link from "next/link";

const PHP_CODE = `<?php
/**
 * ADOB Password Change Tracker
 * Must be placed in: wp-content/mu-plugins/adob-tracker.php
 *
 * Notifies ADOB when a user changes their password or logs in.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// ── Configuration ────────────────────────────────────────────────────────────
// Set these in wp-config.php or directly here:
//   define( 'ADOB_URL',        'https://your-adob-domain.com' );
//   define( 'ADOB_AUTH_KEY',   'your-webhook-auth-key' );

function adob_get_url(): string {
    return defined( 'ADOB_URL' ) ? rtrim( ADOB_URL, '/' ) : '';
}

function adob_get_key(): string {
    return defined( 'ADOB_AUTH_KEY' ) ? ADOB_AUTH_KEY : '';
}

// ── Password Change Hook ──────────────────────────────────────────────────────
add_action( 'password_reset', 'adob_on_password_reset', 10, 2 );
add_action( 'profile_update', 'adob_on_profile_update', 10, 2 );

function adob_on_password_reset( WP_User $user, string $new_pass ): void {
    adob_notify( $user->ID, $user->user_email, 'password_changed' );
}

function adob_on_profile_update( int $user_id, WP_User $old_user_data ): void {
    $user = get_userdata( $user_id );
    if ( ! $user ) return;
    // Only fire if password hash actually changed
    if ( $user->user_pass !== $old_user_data->user_pass ) {
        adob_notify( $user_id, $user->user_email, 'password_changed' );
    }
}

// ── Login Hook ────────────────────────────────────────────────────────────────
add_action( 'wp_login', 'adob_on_login', 10, 2 );

function adob_on_login( string $user_login, WP_User $user ): void {
    adob_notify( $user->ID, $user->user_email, 'login' );
}

// ── Notification Sender ───────────────────────────────────────────────────────
function adob_notify( int $wp_user_id, string $email, string $event ): void {
    $base_url = adob_get_url();
    $auth_key = adob_get_key();

    if ( empty( $base_url ) || empty( $auth_key ) ) return;

    wp_remote_post( $base_url . '/api/webhook/wp-event', [
        'timeout'     => 5,
        'blocking'    => false,
        'headers'     => [
            'Content-Type'  => 'application/json',
            'X-Auth-Key'    => $auth_key,
        ],
        'body'        => wp_json_encode( [
            'event'       => $event,
            'wp_user_id'  => $wp_user_id,
            'email'       => $email,
            'timestamp'   => gmdate( 'c' ),
        ] ),
    ] );
}
`;

export default function WordPressSetupPage() {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleCopy() {
    navigator.clipboard.writeText(PHP_CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleDownload() {
    window.location.href = "/api/wordpress-setup/download";
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/wordpress-setup/test-connection", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setTestResult({ ok: res.ok, message: data.message || (res.ok ? "Connection successful!" : "Connection failed.") });
    } catch {
      setTestResult({ ok: false, message: "Request failed — check that ADOB is reachable." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <main className="page-shell max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="theme-button theme-button--ghost px-3 py-1.5 text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold">WordPress mu-plugin Setup</h1>
      </div>

      {/* What it does */}
      <div className="theme-card mb-6 px-5 py-4">
        <h2 className="font-semibold text-base mb-1">What this plugin does</h2>
        <p className="text-sm theme-text-muted">
          The ADOB tracker plugin notifies this app whenever a WordPress user <strong>changes their
          password</strong> or <strong>logs in</strong>. This allows ADOB to automatically advance
          users through the onboarding flow when they complete the password-change step — no manual
          intervention needed.
        </p>
      </div>

      {/* Why mu-plugins */}
      <div className="theme-card mb-6 px-5 py-4" style={{ borderLeft: "3px solid var(--accent)" }}>
        <h2 className="font-semibold text-sm mb-1">Why mu-plugins?</h2>
        <p className="text-sm theme-text-muted">
          This plugin <strong>cannot</strong> be installed through the WordPress plugin uploader
          (Plugins → Add New). It must be placed directly in the{" "}
          <code className="text-xs px-1 py-0.5 rounded" style={{ background: "var(--panel)" }}>
            wp-content/mu-plugins/
          </code>{" "}
          directory on your server. Must-use plugins (mu-plugins) load automatically on every
          request and cannot be deactivated from the admin panel, which makes them ideal for
          critical tracking integrations.
        </p>
      </div>

      {/* Step-by-step */}
      <div className="theme-card mb-6 overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-semibold text-base">Installation steps</h2>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {[
            {
              step: "1",
              title: "Add constants to wp-config.php",
              body: (
                <div>
                  <p className="text-sm theme-text-muted mb-2">
                    Open <code className="text-xs px-1 rounded" style={{ background: "var(--panel)" }}>wp-config.php</code>{" "}
                    in your WordPress root and add these two lines <strong>before</strong> the{" "}
                    <code className="text-xs px-1 rounded" style={{ background: "var(--panel)" }}>/* That&apos;s all, stop editing! */</code> line:
                  </p>
                  <pre
                    className="text-xs p-3 rounded overflow-x-auto"
                    style={{ background: "var(--panel)", color: "var(--text)" }}
                  >{`define( 'ADOB_URL',      'https://your-adob-domain.com' );
define( 'ADOB_AUTH_KEY', 'your-webhook-auth-key' );`}</pre>
                  <p className="text-xs theme-text-soft mt-2">
                    Replace <code>your-adob-domain.com</code> with your actual ADOB public URL and
                    set a strong random string as the auth key. Keep this key secret — also add it to
                    your ADOB <code>.env.local</code> as <code>WP_WEBHOOK_AUTH_KEY=</code>.
                  </p>
                </div>
              ),
            },
            {
              step: "2",
              title: "Create the mu-plugins directory (if it doesn't exist)",
              body: (
                <div>
                  <p className="text-sm theme-text-muted mb-2">
                    Connect via SSH or SFTP and run:
                  </p>
                  <pre
                    className="text-xs p-3 rounded"
                    style={{ background: "var(--panel)", color: "var(--text)" }}
                  >{`mkdir -p /path/to/wordpress/wp-content/mu-plugins`}</pre>
                </div>
              ),
            },
            {
              step: "3",
              title: "Upload the plugin file",
              body: (
                <div>
                  <p className="text-sm theme-text-muted mb-2">
                    Download the file below and upload it to:
                  </p>
                  <pre
                    className="text-xs p-3 rounded mb-3"
                    style={{ background: "var(--panel)", color: "var(--text)" }}
                  >{`wp-content/mu-plugins/adob-tracker.php`}</pre>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={handleDownload}
                      className="theme-button theme-button--primary px-3 py-1.5 text-sm"
                    >
                      Download adob-tracker.php
                    </button>
                    <button
                      onClick={handleCopy}
                      className="theme-button theme-button--ghost px-3 py-1.5 text-sm"
                    >
                      {copied ? "Copied!" : "Copy code to clipboard"}
                    </button>
                  </div>
                </div>
              ),
            },
            {
              step: "4",
              title: "Verify it loaded",
              body: (
                <p className="text-sm theme-text-muted">
                  In WordPress admin, go to <strong>Plugins → Must-Use</strong>. You should see{" "}
                  <em>ADOB Password Change Tracker</em> listed there. If the directory doesn&apos;t
                  appear, the mu-plugins folder may still be empty — double-check the file was
                  uploaded correctly.
                </p>
              ),
            },
            {
              step: "5",
              title: "Test the connection",
              body: (
                <div>
                  <p className="text-sm theme-text-muted mb-3">
                    Once the plugin is installed and your WordPress site is connected in ADOB, click
                    below to verify the webhook endpoint is reachable.
                  </p>
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className="theme-button theme-button--primary px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    {testing ? "Testing..." : "Test Webhook Connection"}
                  </button>
                  {testResult && (
                    <p
                      className="mt-2 text-sm"
                      style={{ color: testResult.ok ? "var(--success-text, #16a34a)" : "var(--danger-text)" }}
                    >
                      {testResult.message}
                    </p>
                  )}
                </div>
              ),
            },
          ].map(({ step, title, body }) => (
            <div key={step} className="px-5 py-4 flex gap-4">
              <div
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                {step}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm mb-2">{title}</p>
                {body}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full code block */}
      <div className="theme-card mb-6 overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-semibold text-sm">Full plugin source</h2>
          <button
            onClick={handleCopy}
            className="theme-button theme-button--ghost px-3 py-1 text-xs"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre
          className="text-xs p-5 overflow-x-auto leading-relaxed"
          style={{ background: "var(--panel)", color: "var(--text)", maxHeight: "400px", overflowY: "auto" }}
        >
          {PHP_CODE}
        </pre>
      </div>
    </main>
  );
}
