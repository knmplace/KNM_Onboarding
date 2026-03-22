# ADOB — WordPress Setup Guide

ADOB connects to your WordPress site to read and manage users via the ProfileGrid plugin. This document covers what needs to be installed on WordPress and how to create the credentials ADOB needs.

---

## Requirements

- WordPress 6.0+
- [ProfileGrid](https://wordpress.org/plugins/profilegrid-user-profiles-groups-and-communities/) plugin installed and activated
- An admin user account on WordPress

---

## Step 1: Install the Password-Change Tracker mu-plugin

ADOB tracks when users change their WordPress password so it can automatically advance them through the onboarding workflow. This requires a small must-use plugin on your WordPress site.

### What it does

The plugin notifies ADOB whenever a user changes their password or logs in. ADOB uses this to mark the user's onboarding step as complete — no manual intervention needed.

### Why mu-plugins?

This plugin **cannot** be installed through the WordPress plugin uploader (Plugins → Add New). It must be placed directly in the `wp-content/mu-plugins/` directory. Must-use plugins load automatically and cannot be deactivated from the admin panel.

### Installation

The easiest way is to use the built-in guide inside ADOB. After logging in, go to:

```
http://YOUR_SERVER_IP:6001/wordpress-setup
```

That page lets you download the plugin file, view step-by-step instructions, and test the connection.

#### Manual installation

1. Download `adob-tracker.php` from the in-app guide, or copy the source from that page.

2. Upload it to your WordPress server at:
   ```
   wp-content/mu-plugins/adob-tracker.php
   ```
   If the `mu-plugins` directory doesn't exist, create it:
   ```bash
   mkdir -p /path/to/wordpress/wp-content/mu-plugins
   ```

3. Add these two constants to your WordPress `wp-config.php` **before** the `/* That's all, stop editing! */` line:
   ```php
   define( 'ADOB_URL',      'https://your-adob-domain.com' );
   define( 'ADOB_AUTH_KEY', 'your-webhook-auth-key' );
   ```
   - `ADOB_URL` — the public URL of your ADOB app (no trailing slash)
   - `ADOB_AUTH_KEY` — a secret string you choose; also add it to your ADOB `.env.local` as `WP_WEBHOOK_AUTH_KEY=`

4. Verify it loaded: in WordPress admin, go to **Plugins → Must-Use**. You should see *ADOB Password Change Tracker* listed.

---

## Step 2: Create a WordPress Application Password

ADOB authenticates to WordPress using an Application Password (not your regular login password). Application Passwords can be revoked without changing your main password.

### Create the Application Password

1. In WordPress admin, go to **Users → Profile** (or edit the admin user)
2. Scroll down to **Application Passwords**
3. Enter a name (e.g. `ADOB`) and click **Add New Application Password**
4. Copy the generated password — it is shown **once only**

The password looks like: `xxxx xxxx xxxx xxxx xxxx xxxx` (spaces are fine — ADOB accepts both formats)

### Add credentials to ADOB

During `deploy.sh`, enter when prompted:
- `WORDPRESS_URL` — your WordPress site URL (e.g. `https://yoursite.com`)
- `WORDPRESS_USERNAME` — the WordPress admin username
- `WORDPRESS_APP_PASSWORD` — the Application Password you just created

Or skip during deploy and configure later via **Sites → Edit** in the ADOB dashboard.

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

When ADOB deletes a WordPress user, WordPress requires the user's content to be reassigned. ADOB handles this automatically. To specify a fixed reassignment user, add to your ADOB `.env.local`:

```
WORDPRESS_REASSIGN_USER_ID=1
```

Replace `1` with the WordPress user ID you want content assigned to.

---

## Troubleshooting

**"WordPress connection failed" in ADOB:**
- Confirm `WORDPRESS_URL` has no trailing slash
- Confirm the Application Password is correct (try removing spaces)
- Confirm the WordPress user has the `administrator` role

**"ProfileGrid connection failed":**
- Confirm the ProfileGrid plugin is active
- Visit `YOUR_WORDPRESS_URL/wp-json/profilegrid/v1/members` in a browser — should return JSON or a 401

**Password changes aren't being tracked:**
- Confirm `adob-tracker.php` is in `wp-content/mu-plugins/`
- Confirm `ADOB_URL` in `wp-config.php` points to the correct ADOB URL and is reachable from the WordPress server
- Check WordPress error logs: `wp-content/debug.log` (if `WP_DEBUG_LOG` is enabled)
