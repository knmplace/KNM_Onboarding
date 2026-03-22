"use client";

import { useState } from "react";
import Link from "next/link";

const PHP_CODE = `<?php
/**
 * Plugin Name: Password Change Tracker
 * Description: Tracks when users change their passwords for onboarding.
 *              Writes last_password_change to user_meta and exposes it in REST API.
 * Version: 1.1
 *
 * Install: Copy this file to wp-content/mu-plugins/password-change-tracker.php
 */

function adob_set_last_password_change($user_id) {
    update_user_meta($user_id, 'last_password_change', wp_date('c'));
}

function adob_set_last_login_at($user_id) {
    update_user_meta($user_id, 'last_login_at', wp_date('c'));
}

add_action('after_password_reset', function($user) {
    adob_set_last_password_change($user->ID);
});

add_action('wp_set_password', function($password, $user_id, $old_user_data) {
    adob_set_last_password_change($user_id);
}, 10, 3);

add_action('profile_update', function($user_id, $old_user_data, $userdata) {
    if (!empty($userdata['user_pass'])) {
        adob_set_last_password_change($user_id);
    }
}, 10, 3);

add_action('wp_login', function($user_login, $user) {
    if ($user && isset($user->ID)) {
        adob_set_last_login_at((int) $user->ID);
    }
}, 10, 2);

add_action('set_logged_in_cookie', function($logged_in_cookie, $expire, $expiration, $user_id) {
    if (!empty($user_id)) {
        adob_set_last_login_at((int) $user_id);
    }
}, 10, 4);

add_action('rest_api_init', function() {
    register_meta('user', 'last_password_change', [
        'type'        => 'string',
        'single'      => true,
        'show_in_rest' => true,
        'description' => 'ISO timestamp of last password change',
    ]);
    register_meta('user', 'last_login_at', [
        'type'        => 'string',
        'single'      => true,
        'show_in_rest' => true,
        'description' => 'ISO timestamp of most recent successful login',
    ]);
});
`;

export default function WordPressSetupPage() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(PHP_CODE).then(() => {
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
        <h1 className="text-2xl font-bold">WordPress mu-plugin</h1>
      </div>

      <div className="theme-card mb-4 px-5 py-4">
        <p className="text-sm theme-text-muted">
          Upload <strong>password-change-tracker.php</strong> to{" "}
          <code className="text-xs px-1 py-0.5 rounded" style={{ background: "var(--panel)" }}>
            wp-content/mu-plugins/
          </code>{" "}
          on your WordPress server. No configuration needed — it writes password change and login timestamps directly to WordPress user meta, which ADOB reads during sync.
        </p>
      </div>

      <div className="theme-card overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm font-medium">adob-tracker.php</span>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="theme-button theme-button--ghost px-3 py-1 text-xs"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <a
              href="/api/wordpress-setup/download"
              className="theme-button theme-button--primary px-3 py-1 text-xs"
            >
              Download
            </a>
          </div>
        </div>
        <pre
          className="text-xs p-5 overflow-x-auto leading-relaxed"
          style={{ background: "var(--panel)", color: "var(--text)" }}
        >
          {PHP_CODE}
        </pre>
      </div>
    </main>
  );
}
