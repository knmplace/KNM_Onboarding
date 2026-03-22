import { NextResponse } from "next/server";

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

export async function GET() {
  return new NextResponse(PHP_CODE, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="password-change-tracker.php"',
    },
  });
}
