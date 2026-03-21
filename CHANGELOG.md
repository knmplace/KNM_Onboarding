# Changelog

All notable changes to ADOB will be documented here.

---

## [Unreleased]

### Added
- `update.sh` — safe, non-destructive update script for existing installs
  - preserves `.env.local` and all credentials
  - backs up `.env.local` before every run
  - rsyncs code only, then rebuilds and restarts PM2
  - runs `prisma db push` non-destructively for schema changes
  - restarts webhook systemd service if present
- Forgot-password link discovery for reminder and deactivation emails
  - `discoverForgotPasswordUrl()` in `site-config.ts` — scrapes the managed site's login page for a reset URL, falls back to standard WordPress lost-password path
  - Connection test (`/api/sites/[id]/connections`) now reports forgot-password URL discovery result
  - Reminder and deactivation email templates now include a "Reset it here" link when a URL can be resolved

---

## [1.0.0]

### Added
- Initial release: self-deployable user onboarding management system
- `deploy.sh` — 10-phase interactive installer for Linux
- First-run setup wizard (`/setup`) with bcrypt PIN authentication
- Multi-site support: manage onboarding for multiple WordPress sites
- n8n workflow auto-provisioning on site creation
- Optional auto-deploy webhook support for GitHub and Gitea
- PM2 process management with systemd boot persistence
- Local PostgreSQL install option (via deploy.sh)
- Local n8n install option via Docker (via deploy.sh)

---

<!--
Format for future entries:

## [1.0.1] — YYYY-MM-DD

### Added
- New feature description

### Changed
- What was modified

### Fixed
- Bug that was fixed

### Removed
- What was removed
-->
