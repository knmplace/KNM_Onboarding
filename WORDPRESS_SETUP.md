# ADOB — WordPress Setup Guide

ADOB connects to your WordPress site to read and manage users via the ProfileGrid plugin. This document covers what needs to be installed on WordPress and how to create the credentials ADOB needs.

---

## Requirements

- WordPress 6.0+
- [ProfileGrid](https://wordpress.org/plugins/profilegrid-user-profiles-groups-and-communities/) plugin installed and activated
- An admin user account on WordPress

---

## Step 1: Install the Password-Change Tracker mu-plugin

ADOB tracks when users change their WordPress password so it can advance them through the onboarding workflow automatically. This requires a small must-use plugin on your WordPress site.

### What it does

The plugin fires a webhook to ADOB whenever a user's password changes in WordPress. ADOB receives this and marks the user's onboarding step as `awaiting_password_change` → `completed`.

### Installation

1. Copy the file `wordpress/password-change-tracker.php` from this repository to your WordPress server.

2. Place it in the must-use plugins directory:
   ```
   /wp-content/mu-plugins/password-change-tracker.php
   ```
   If the `mu-plugins` directory doesn't exist, create it:
   ```bash
   mkdir -p /path/to/wordpress/wp-content/mu-plugins
   ```

3. Open the file and set the two configuration constants at the top:
   ```php
   define('ADOB_WEBHOOK_URL', 'http://YOUR_SERVER_IP:6000/api/onboarding/password-changed');
   define('ADOB_WEBHOOK_SECRET', 'your_N8N_WEBHOOK_AUTH_KEY_value');
   ```
   - `ADOB_WEBHOOK_URL` — the full URL to your ADOB app's webhook endpoint
   - `ADOB_WEBHOOK_SECRET` — the value of `N8N_WEBHOOK_AUTH_KEY` from your ADOB `.env.local`

4. Must-use plugins are loaded automatically — no activation step needed. You can verify it's loaded by going to **Plugins → Must-Use** in the WordPress admin.

---

## Step 2: Create a WordPress Application Password

ADOB authenticates to your WordPress site using a WordPress Application Password (not your regular login password). Application Passwords are safe to use — they can be revoked without changing your main password.

### Create the Application Password

1. In WordPress admin, go to **Users → Profile** (or **Users → All Users** and edit the admin user)
2. Scroll down to **Application Passwords**
3. Enter a name (e.g. `ADOB`) in the "New Application Password Name" field
4. Click **Add New Application Password**
5. Copy the generated password — it is shown **once only**

The password will look like: `xxxx xxxx xxxx xxxx xxxx xxxx` (spaces are fine — ADOB accepts both formats)

### Add the credentials to ADOB

During `deploy.sh`, enter when prompted:
- `WORDPRESS_URL` — your WordPress site URL (e.g. `https://yoursite.com`)
- `WORDPRESS_USERNAME` — the admin WordPress username
- `WORDPRESS_APP_PASSWORD` — the Application Password you just created

Or, if you skipped WordPress setup during `deploy.sh`, enter these via the ADOB setup wizard at `http://YOUR_SERVER_IP:6000/setup`.

---

## Step 3: Configure ProfileGrid

ProfileGrid must be installed and have at least one user group configured. ADOB reads users from ProfileGrid's REST API.

### Verify ProfileGrid is working

In WordPress admin:
- Go to **ProfileGrid → Groups** and confirm at least one group exists
- Go to **ProfileGrid → Members** and confirm users appear

### Test the API connection

From the ADOB dashboard, go to **Sites → Edit** on your site and click **Test WordPress Connection** and **Test ProfileGrid Connection**. Both should return green.

---

## Optional: User Reassignment

When ADOB deletes a WordPress user, WordPress requires the user's content to be reassigned to another user. ADOB handles this automatically by finding an admin user to reassign to.

If you want to specify a fixed reassignment user, add this to your ADOB `.env.local`:
```
WORDPRESS_REASSIGN_USER_ID=1
```
Replace `1` with the WordPress user ID of the admin you want content assigned to.

---

## Troubleshooting

**"WordPress connection failed" in ADOB:**
- Confirm `WORDPRESS_URL` in `.env.local` does not have a trailing slash (or confirm your server handles both)
- Confirm the Application Password has no spaces (or test with spaces removed)
- Confirm the WordPress user has the `administrator` role

**"ProfileGrid connection failed":**
- Confirm the ProfileGrid plugin is active
- Visit `YOUR_WORDPRESS_URL/wp-json/profilegrid/v1/members` in a browser — it should return JSON (or a 401 auth error, which is expected)

**Password changes aren't being tracked:**
- Confirm the mu-plugin file is in `wp-content/mu-plugins/`
- Confirm `ADOB_WEBHOOK_URL` points to the correct ADOB endpoint and is reachable from the WordPress server
- Check WordPress error logs for any plugin errors: `wp-content/debug.log` (if `WP_DEBUG_LOG` is enabled)
