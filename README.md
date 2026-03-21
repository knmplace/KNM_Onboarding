# ADOB — Automated Deployment Onboarding Builder

ADOB is a self-hostable user onboarding management system built with Next.js. It connects to your WordPress site (with the ProfileGrid plugin) to sync users, validate email addresses, send breach-alert notifications, and guide new users through an onboarding workflow — all from a protected admin dashboard.

A single `deploy.sh` script installs and configures everything: Node.js, PostgreSQL, n8n workflow automation, PM2 process management, and an optional git-based auto-deploy webhook. No manual server setup required.

---

## Features

- **Multi-site support** — manage onboarding for multiple WordPress sites from one dashboard
- **User lifecycle tracking** — `pending_approval` → `awaiting_password_change` → `completed`
- **Email validation** — Abstract API integration for breach detection (optional)
- **Automated reminders** — n8n-powered scheduled email reminders
- **First-run setup wizard** — PIN-protected credential entry for credentials not set during deploy
- **Auto-deploy webhooks** — push to GitHub and the server rebuilds automatically
- **PM2 process management** — survives reboots, restarts on crash

---

## Requirements

- Linux server (Ubuntu 20.04+, Debian 11+, Rocky Linux 8+, RHEL 8+)
- Root or sudo access
- Node.js 20 LTS (installed by `deploy.sh` if missing)
- PostgreSQL (local install handled by `deploy.sh`, or bring your own)
- n8n (local Docker install handled by `deploy.sh`, or bring your own)
- A WordPress site with the ProfileGrid plugin (required for user management)
- An SMTP account for sending emails

---

## Quick Start

```bash
git clone https://github.com/knmplace/KNM_Onboarding.git
cd KNM_Onboarding
bash deploy.sh
```

`deploy.sh` walks you through setup interactively. It asks two binary questions about PostgreSQL and n8n (existing instance or local install), then automates everything else.

---

## Documentation

| File | Contents |
|------|----------|
| [DEPLOY.md](DEPLOY.md) | Full deployment walkthrough, update.sh usage, manual fallback steps |
| [N8N_SETUP.md](N8N_SETUP.md) | n8n requirements, local vs remote, API key setup |
| [WORDPRESS_SETUP.md](WORDPRESS_SETUP.md) | WordPress mu-plugin install, Application Password setup |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [ERRORS.md](ERRORS.md) | Known issues, fixes applied, troubleshooting |

---

## First-Run Setup Wizard

If any credentials were skipped during `deploy.sh`, the app starts in setup mode. Visit the app URL in your browser — you will be redirected to `/setup` automatically.

The setup wizard requires a PIN that `deploy.sh` prints at the end of installation. Enter the PIN, fill in the remaining credentials, and the app restarts with full configuration.

---

## License

MIT

---

## Contributing

Pull requests welcome. Please open an issue first for significant changes.
