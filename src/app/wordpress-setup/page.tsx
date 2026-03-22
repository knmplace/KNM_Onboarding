"use client";

import { useState } from "react";
import Link from "next/link";

const PHP_CODE = `<?php
/**
 * ADOB Password Change Tracker
 * Place this file in: wp-content/mu-plugins/adob-tracker.php
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'ADOB_WEBHOOK_URL', 'http://YOUR_SERVER_IP:6001/api/webhook/wp-event' );
define( 'ADOB_WEBHOOK_SECRET', 'your_webhook_secret_here' );

add_action( 'password_reset', 'adob_on_password_reset', 10, 2 );
add_action( 'profile_update', 'adob_on_profile_update', 10, 2 );

function adob_on_password_reset( WP_User $user, string $new_pass ): void {
    adob_notify( $user->ID, $user->user_email, 'password_changed' );
}

function adob_on_profile_update( int $user_id, WP_User $old_user_data ): void {
    $user = get_userdata( $user_id );
    if ( ! $user ) return;
    if ( $user->user_pass !== $old_user_data->user_pass ) {
        adob_notify( $user_id, $user->user_email, 'password_changed' );
    }
}

add_action( 'wp_login', 'adob_on_login', 10, 2 );

function adob_on_login( string $user_login, WP_User $user ): void {
    adob_notify( $user->ID, $user->user_email, 'login' );
}

function adob_notify( int $wp_user_id, string $email, string $event ): void {
    wp_remote_post( ADOB_WEBHOOK_URL, [
        'timeout'  => 5,
        'blocking' => false,
        'headers'  => [
            'Content-Type'     => 'application/json',
            'X-Webhook-Secret' => ADOB_WEBHOOK_SECRET,
        ],
        'body' => wp_json_encode( [
            'event'      => $event,
            'wp_user_id' => $wp_user_id,
            'email'      => $email,
            'timestamp'  => gmdate( 'c' ),
        ] ),
    ] );
}
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
          Upload <strong>adob-tracker.php</strong> to{" "}
          <code className="text-xs px-1 py-0.5 rounded" style={{ background: "var(--panel)" }}>
            wp-content/mu-plugins/
          </code>{" "}
          on your WordPress server. Edit the two constants at the top of the file to match your ADOB URL and webhook secret before uploading.
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
