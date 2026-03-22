# Changelog

---

## [2.3.0] — 2026-03-22

### Added
- **UI Update button** — Settings page now has an "App Update" section with a clear description of what the update does, a warning about downtime, and a one-click "Update Homestead" button
- **`POST /api/admin/update`** — authenticated API route that triggers `update.sh` in the background and responds immediately; update log written to `/opt/homestead/logs/update.log`
- **`/opt/homestead-src`** — deploy.sh now moves the source clone to `/opt/homestead-src` regardless of where the user originally cloned, eliminating the messy `/homestead` in filesystem root

### Changed
- **deploy.sh**: source clone is automatically relocated to `/opt/homestead-src` after deploy; original clone folder outside `/opt` is cleaned up automatically
- **update.sh**: fully rewritten for Homestead naming; pulls from `/opt/homestead-src` git repo before syncing; all `adob` references replaced

### Fixed
- **Clone location pollution**: users running `git clone` from `/` root no longer left with a `/homestead` directory after deploy

---

## [2.2.0] — 2026-03-22

### Changed
- **Project renamed from ADOB to Homestead** — all internal references updated
- Install directory: `/opt/adob` → `/opt/homestead`
- PM2 process name: `adob` → `homestead`
- DB name/user: `adob` / `adob_user` → `homestead` / `homestead_user`
- System user for webhook service: `adob` → `homestead`
- Systemd service: `webhook-adob` → `webhook-homestead`
- localStorage keys updated to `homestead_*` prefix
- GitHub repo renamed from `KNM_Onboarding` → `homestead`
- Logo added to `public/logo.jpg`
- README fully rewritten for Homestead branding

---

## [2.1.0] — 2026-03-22

### Added
- **KNM Onboarding Helper plugin** — renamed from "Password Change Tracker", now ships as a proper WordPress plugin:
  - Plugin name: `KNM Onboarding Helper` | file: `knm-onboarding-helper.php` | version: 1.2
  - Single source of truth in `src/lib/plugin-source.ts` (PHP content + ZIP builder shared across all routes)
- **Auto-install + activate** (`POST /api/sites/[id]/install-plugin`):
  - Builds plugin ZIP in-process (no `archiver` dependency — pure Node.js ZIP implementation)
  - Uploads to WordPress via `POST /wp-json/wp/v2/plugins` (requires admin credentials)
  - Activates immediately via `PUT /wp-json/wp/v2/plugins/knm-onboarding-helper/knm-onboarding-helper`
  - Surfaces clear error if WP user lacks Administrator role (403)
  - Handles already-installed gracefully (409 → skip to activate)
- **ZIP download** (`GET /api/wordpress-setup/download?format=zip`) — standard WP plugin ZIP for Admin → Plugins → Upload
- **PHP download** (`GET /api/wordpress-setup/download?format=php`) — raw file for mu-plugins manual install
- **Sites page** — connection test results now show `Install Plugin Automatically` + `Download ZIP` + `Install instructions →` when tracker check fails
- **Checklist** — mu-plugin item now has a direct `↓ Download ZIP` button alongside Guide and Mark Done
- **WordPress Setup page** — redesigned as a numbered 3-method guide:
  1. Auto-install from Sites page (recommended)
  2. Upload ZIP via WP Admin UI
  3. Manual mu-plugins copy (server access required)
- **`app_settings` DB table** — key/value store for app-level config (Prisma model `AppSetting`)
- **`src/lib/app-settings.ts`** — `getSetting` / `setSetting` / `deleteSetting` helpers
- **Abstract API key now stored in DB** — `/api/settings/abstract-api` reads/writes `app_setting` table instead of `.env.local`; env var still works as fallback for backwards compat; no restart needed after saving
- **`.npmrc`** with `audit-level=critical` — suppresses moderate/high dev-dep audit noise during install

### Changed
- `deploy.sh` and `update.sh` audit fix step now filters output to critical-only (silent on Prisma dev-dep warnings)
- `src/lib/abstract-api.ts` resolves API key dynamically at call time: env → DB fallback
- `/api/checklist` checks DB for Abstract API key status (env var still accepted as fallback)

---

High-level summary of notable changes to ADOB.

---

## [2.0.0] — 2026-03-21

### Breaking Changes
- **n8n removed entirely.** No Docker, no API keys, no workflow imports required. Scheduler is now built into the app.
- **Setup wizard simplified.** Only collects admin name, email, and password. SMTP and WordPress are configured post-login via the Getting Started checklist.
- App port changed from 6000 → **6001**.

### Added
- Built-in scheduler via `node-cron` — runs at startup in production, no external services needed:
  - User sync every 15 minutes
  - Reminder emails weekly (Monday 08:00 UTC)
  - Breach rescan monthly (1st of month 08:00 UTC)
- **Getting Started checklist** on dashboard — self-verifying setup steps with per-item actions and localStorage dismiss
- **WordPress mu-plugin setup page** (`/wordpress-setup`) — downloadable plugin file, code viewer, step-by-step instructions, test connection button
- **DB-driven SMTP default** — mark any SMTP server in the library as default without restarting the app
- `/api/checklist` — backend endpoint verifying each setup step against live DB and env state

### Changed
- `deploy.sh` — removed all n8n and Docker phases; hardcoded install dir, port, PM2 name; public URL pre-filled with detected server IP
- `getMailerConfigForSite` is now async; resolution order: site SMTP → DB `isDefault` server → `.env.local` fallback
- `WORDPRESS_SETUP.md` updated to reference new in-app guide page

### Removed
- `N8N_SETUP.md` — n8n is no longer part of ADOB
- n8n automation scripts and env vars

---

## [1.1.2]

### Fixed
- Setup PIN always "Incorrect" — ecosystem config was using `npm start` instead of `start.mjs`, causing dotenvx to load 0 env vars (bcrypt `$` chars break dotenvx parsing). Switched to `start.mjs` in deploy.sh ecosystem template.
- PIN hash storage moved from `.env.local` to dedicated `.pin-hash` file — eliminates all dotenvx interpolation and shell quoting issues permanently.
- Site seed fails with `null value in column "updated_at"` — Prisma `@updatedAt` has no DB-level DEFAULT; added idempotent `ALTER TABLE site ALTER COLUMN updated_at SET DEFAULT NOW()` in `ensure-default-site.js`.

## [Unreleased]

### Added
- Safe update script for existing installs
- Forgot-password link discovery for reminder emails
- Email template improvements and logo layout updates
- Persisted light/dark theme toggle with neutral dark palette
- Theme-aware styling across dashboard, Sites, Deleted Users, login, setup, and guide modal
- Local AdminUser table with OWNER/ADMIN roles — app auth fully decoupled from WordPress
- Setup wizard Step 2 now collects admin account (first name, last name, email, password) + SMTP; WordPress fields removed
- Login page updated to email/password; WordPress login kept but commented out for future use
- Middleware auth guard: JWT verification for all non-public routes, redirects to /login on expiry
- Settings page (`/settings`) with App Default SMTP editor and SMTP Server Library
- SMTP Server Library: reusable pool of named SMTP servers (Gmail, Outlook, SendGrid, etc.) stored in DB
- Provider presets on both Settings and Sites SMTP forms (Gmail, Outlook, Office 365, Yahoo, SendGrid, Mailgun, SES, Brevo, Postmark)
- Sites page: SMTP server picker — selecting a library server copies its settings to the site; shown in site card
- Settings link added to main dashboard nav
- Slug sanitization in `ensure-default-site.js` — invalid input auto-converted to kebab-case

### Fixed
- Setup "Restart & Launch" reloaded setup page instead of redirecting to /login (Issue 15)
- Default site slug set to invalid value from user input — slugify() now applied before seeding (Issue 16)
- Build error after AdminUser refactor — wrong PrismaClient import path (Issue 17)
- WordPress credentials were required when adding sites — now optional (Issue 18)

---

## [1.0.0]

### Added
- Initial release: self-deployable user onboarding management system
- Interactive installer with multi-phase setup
- First-run setup wizard with PIN authentication
- Multi-site support for managing multiple WordPress sites
- n8n workflow auto-provisioning
- Automated email reminders and user lifecycle management
