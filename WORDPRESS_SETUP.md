# Homestead — WordPress Setup Guide

Homestead connects to your WordPress site to read and manage users via the ProfileGrid plugin. This document covers what needs to be installed on WordPress and how to create the credentials Homestead needs.

---

## Requirements

- WordPress 6.0+
- [ProfileGrid](https://wordpress.org/plugins/profilegrid-user-profiles-groups-and-communities/) plugin installed and activated
- An admin user account on WordPress

---

## Step 1: Install the Password-Change Tracker mu-plugin

Homestead tracks when users change their WordPress password so it can automatically advance them through the onboarding workflow. This requires a small must-use plugin on your WordPress site.

### What it does

The plugin notifies Homestead whenever a user changes their password or logs in. Homestead uses this to mark the user's onboarding step as complete — no manual intervention needed.

### Why mu-plugins?

This plugin **cannot** be installed through the WordPress plugin uploader (Plugins → Add New). It must be placed directly in the `wp-content/mu-plugins/` directory. Must-use plugins load automatically and cannot be deactivated from the admin panel.

### Installation

The easiest way is to use the built-in guide inside Homestead. After logging in, go to:

```
http://YOUR_SERVER_IP:6001/wordpress-setup
```

That page lets you download the plugin file, view step-by-step instructions, and test the connection.

#### Manual installation

1. Download `homestead-tracker.php` from the in-app guide, or copy the source from that page.

2. Upload it to your WordPress server at:
   ```
   wp-content/mu-plugins/homestead-tracker.php
   ```
   If the `mu-plugins` directory doesn't exist, create it:
   ```bash
   mkdir -p /path/to/wordpress/wp-content/mu-plugins
   ```

3. Add these two constants to your WordPress `wp-config.php` **before** the `/* That's all, stop editing! */` line:
   ```php
   define( 'HOMESTEAD_URL',      'https://your-homestead-domain.com' );
   define( 'HOMESTEAD_AUTH_KEY', 'your-webhook-auth-key' );
   ```
   - `HOMESTEAD_URL` — the public URL of your Homestead app (no trailing slash)
   - `HOMESTEAD_AUTH_KEY` — a secret string you choose; also add it to your Homestead `.env.local` as `WP_WEBHOOK_AUTH_KEY=`

4. Verify it loaded: in WordPress admin, go to **Plugins → Must-Use**. You should see *Homestead Password Change Tracker* listed.

---

## Step 2: Create a WordPress Application Password

Homestead authenticates to WordPress using an Application Password (not your regular login password). Application Passwords can be revoked without changing your main password.

### Create the Application Password

1. In WordPress admin, go to **Users → Profile** (or edit the admin user)
2. Scroll down to **Application Passwords**
3. Enter a name (e.g. `Homestead`) and click **Add New Application Password**
4. Copy the generated password — it is shown **once only**

The password looks like: `xxxx xxxx xxxx xxxx xxxx xxxx` (spaces are fine — Homestead accepts both formats)

### Add credentials to Homestead

After logging in, go to **Sites** and add or edit your site. Enter:
- **WordPress Site URL** — e.g. `https://yoursite.com`
- **WordPress Username** — the admin username
- **Application Password** — the password you just created

---

## Step 3: Configure ProfileGrid

ProfileGrid must be installed and have at least one user group configured. Homestead reads users from ProfileGrid's REST API.

### Verify ProfileGrid is working

In WordPress admin:
- Go to **ProfileGrid → Groups** and confirm at least one group exists
- Go to **ProfileGrid → Members** and confirm users appear

### Test the API connection

From the Homestead dashboard, go to **Sites → Edit** on your site and click **Test WordPress Connection** and **Test ProfileGrid Connection**. Both should return green.

---

## Optional: User Reassignment

When Homestead deletes a WordPress user, WordPress requires the user's content to be reassigned. Homestead handles this automatically. To specify a fixed reassignment user, add to your Homestead `.env.local`:

```
WORDPRESS_REASSIGN_USER_ID=1
```

Replace `1` with the WordPress user ID you want content assigned to.

---

## Troubleshooting

**"WordPress connection failed" in Homestead:**
- Confirm the WordPress URL has no trailing slash
- Confirm the Application Password is correct (try removing spaces)
- Confirm the WordPress user has the `administrator` role

**"ProfileGrid connection failed":**
- Confirm the ProfileGrid plugin is active
- Visit `YOUR_WORDPRESS_URL/wp-json/profilegrid/v1/members` in a browser — should return JSON or a 401

**Password changes aren't being tracked:**
- Confirm `homestead-tracker.php` is in `wp-content/mu-plugins/`
- Confirm `HOMESTEAD_URL` in `wp-config.php` points to the correct Homestead URL and is reachable from the WordPress server
- Check WordPress error logs: `wp-content/debug.log` (if `WP_DEBUG_LOG` is enabled)
