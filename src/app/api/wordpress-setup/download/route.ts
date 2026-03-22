import { NextResponse } from "next/server";

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

export async function GET() {
  return new NextResponse(PHP_CODE, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="adob-tracker.php"',
    },
  });
}
