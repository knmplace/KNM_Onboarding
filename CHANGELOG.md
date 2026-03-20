# Changelog

All notable changes to ADOB will be documented here.

---

## [Unreleased]

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
