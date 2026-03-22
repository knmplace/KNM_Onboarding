# Homestead — Project Progress Log

Tracks what changed, why, and current status. Updated after each work session.

---

## 2026-03-22 — Session 4 (v2.3.0 — Update infrastructure + UI)

### What Changed

#### Source directory structure
- deploy.sh now moves clone to `/opt/homestead-src` after install, regardless of where user cloned from
- Original clone outside `/opt` is cleaned up automatically — fixes messy `/homestead` in filesystem root
- update.sh now pulls from `/opt/homestead-src` git repo before syncing to `/opt/homestead`

#### update.sh fully rewritten
- All `adob` references replaced with `homestead`
- Install dir: `/opt/homestead`, source dir: `/opt/homestead-src`
- Webhook service: `webhook-homestead`
- Pulls latest code from git before syncing

#### UI Update button (Settings page)
- New "App Update" section in Settings with current version display
- Clear 6-step description of what the update does
- Downtime warning (2–5 min)
- "Update Homestead" button — calls `POST /api/admin/update`
- `src/app/api/admin/update/route.ts` — authenticated route, runs update.sh in background, logs to `/opt/homestead/logs/update.log`

#### Docs & version
- ERRORS.md: issues 22 + 23 added (clone location, update.sh rename miss)
- TODO.md: future roadmap updated, auto-update on push added
- CHANGELOG.md: v2.3.0 entry added
- version.ts + package.json: bumped to 2.3.0

### Pending / Next
- Auto-update on git push (webhook auto-deploy) — groundwork laid
- Migrate App Default SMTP to DB flag

---

## 2026-03-22 — Session 3 (Rename: ADOB → Homestead)

### Deployed
- v2.2.0 — project renamed to Homestead
- GitHub repo renamed: `KNM_Onboarding` → `homestead`

### What Changed

#### Project Rename
- All `adob` references replaced with `homestead` across all files
- `deploy.sh`: install dir, DB name/user, PM2 name, system user, systemd service name, all display strings
- `package.json`: name field + version bump 2.0.0 → 2.2.0
- `ecosystem.linux.config.js`: PM2 name default, install dir default, header comment
- `src/lib/version.ts`: version 2.0.0 → 2.2.0
- `src/app/api/setup/restart/route.ts`: PM2 name fallback
- `src/app/page.tsx`: localStorage key
- `src/components/getting-started.tsx`: localStorage keys
- `src/components/theme-provider.tsx`: localStorage key
- `README.md`: fully rewritten for Homestead branding, logo added
- `CHANGELOG.md`: v2.2.0 entry added
- Logo added: `public/logo.jpg`

---

## 2026-03-22 — Session 2

### Deployed
- v2.1.0 live on test server `192.168.1.174:6001`
- GitHub: `https://github.com/knmplace/KNM_Onboarding` (main branch, commit `88f4c60`)

### What Changed

#### KNM Onboarding Helper (plugin rename + auto-install)
- Renamed WordPress plugin from "Password Change Tracker" → **KNM Onboarding Helper**
- Plugin file: `knm-onboarding-helper.php` | ZIP: `knm-onboarding-helper.zip`
- PHP source centralized in `src/lib/plugin-source.ts`
- New API: `POST /api/sites/[id]/install-plugin` — uploads ZIP + auto-activates via WP REST API
- Download endpoint now supports `?format=zip` (default) and `?format=php`
- Sites page: Install Plugin + Download ZIP buttons appear when tracker connection test fails
- Checklist: direct Download ZIP button on mu-plugin step
- WordPress Setup page: redesigned 3-method numbered guide

#### app_settings DB Table (Abstract API key → DB)
- New `AppSetting` Prisma model (`app_setting` table, key/value)
- `src/lib/app-settings.ts` — getSetting / setSetting / deleteSetting
- Abstract API key stored in DB, no longer written to `.env.local`
- No restart needed after saving; survives redeployments

#### Audit Noise Suppression
- `.npmrc`: `audit-level=critical`
- `deploy.sh` + `update.sh`: audit fix output filtered to critical-only

### Open Items
- [ ] Test auto-install via real WordPress site (requires admin credentials to be configured)
- [ ] Consider adding `app_settings` UI section for future app-level keys (currently only Abstract API uses it)
- [ ] v3 planning: CMS adapter pattern (abstract WP/ProfileGrid behind interface)

---

## 2026-03-21 — Session 1 (v2.0.0 release)

### What Changed
- Removed n8n entirely — replaced with built-in `node-cron` scheduler
- Setup wizard simplified (admin name/email/password only)
- Getting Started checklist added to dashboard
- Settings page: SMTP library, Abstract API key configuration
- Theme system: light/dark mode with localStorage persistence
- Port changed 6000 → 6001 (x11 conflict)
- `deploy.sh` fully rewritten — 10-phase installer, no Docker, no n8n
- `update.sh` created — non-destructive updater (rsync, npm, prisma, pm2)
- `CHANGELOG.md`, `ERRORS.md`, `TODO.md`, `PLAN.md` all documented

### Server State (192.168.1.174)
| Item | Value |
|------|-------|
| App dir | `/opt/adob` |
| Repo clone | `/opt/KNM_Onboarding` |
| PM2 name | `adob` |
| Port | `6001` |
| DB | PostgreSQL local, `adob` database |
| env backup | `/opt/adob/backups/` |

### SSH Access
- Credentials: `b:/Claude_Apps/adob/.ssh.env`
- Connection method: `b:/Claude_Apps/adob/.claude-ssh.md` (plink.exe — see file for exact commands)
