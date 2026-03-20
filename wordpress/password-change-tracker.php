<?php
/**
 * Plugin Name: Password Change Tracker
 * Description: Tracks when users change their passwords for onboarding.
 *              Writes `last_password_change` to user_meta and exposes it in REST API.
 * Version: 1.1
 * Author: KNMPLACE
 *
 * Install: Copy this file to wp-content/mu-plugins/password-change-tracker.php
 */

function onboarding_set_last_password_change($user_id) {
    // ISO-8601 with timezone offset for reliable parsing in external systems.
    update_user_meta($user_id, 'last_password_change', wp_date('c'));
}

function onboarding_set_last_login_at($user_id) {
    update_user_meta($user_id, 'last_login_at', wp_date('c'));
}

// Lost-password / reset flow.
add_action('after_password_reset', function($user) {
    onboarding_set_last_password_change($user->ID);
});

// Fires whenever WP sets a user password (covers profile, reset, API, wp_set_password calls).
add_action('wp_set_password', function($password, $user_id, $old_user_data) {
    onboarding_set_last_password_change($user_id);
}, 10, 3);

// Extra fallback path in case some profile flows bypass wp_set_password hook.
add_action('profile_update', function($user_id, $old_user_data, $userdata) {
    if (!empty($userdata['user_pass'])) {
        onboarding_set_last_password_change($user_id);
    }
}, 10, 3);

// Track successful login activity.
add_action('wp_login', function($user_login, $user) {
    if ($user && isset($user->ID)) {
        onboarding_set_last_login_at((int) $user->ID);
    }
}, 10, 2);

// Additional coverage for custom auth flows that may bypass wp_login.
add_action('set_logged_in_cookie', function($logged_in_cookie, $expire, $expiration, $user_id) {
    if (!empty($user_id)) {
        onboarding_set_last_login_at((int) $user_id);
    }
}, 10, 4);

add_action('rest_api_init', function() {
    register_meta('user', 'last_password_change', [
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'description' => 'ISO timestamp of last password change',
    ]);
    register_meta('user', 'last_login_at', [
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'description' => 'ISO timestamp of most recent successful login',
    ]);
});
