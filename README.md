# Homestead — Client Onboarding Management Platform

> **By [KNMPlace](https://knmplace.com) — Deploy once. Onboard clients with confidence.**

Homestead is a self-hostable onboarding management platform built for businesses and the developers who serve them. It connects to your WordPress site to automate the entire client onboarding workflow — from account approval to password setup to security verification — all managed from a clean, secure admin dashboard.

One script. One server. Zero manual steps.

---

## The Problem With Manual Onboarding

Most businesses handle new client accounts the same way: someone manually creates a login, emails credentials in plain text, follows up days later when the client still hasn't logged in, and has no idea if the email was even delivered — let alone if the account is secure.

It's slow. It's inconsistent. It's a security liability.

**Homestead fixes all of it.**

---

## What Homestead Does

The moment a new user is added to your WordPress site, Homestead takes over:

| Stage | What Happens |
|-------|-------------|
| **Registration** | New user synced from WordPress/ProfileGrid automatically |
| **Breach Check** | Email checked against public breach databases instantly |
| **Admin Review** | You approve or hold — full visibility before activation |
| **Account Activation** | Branded welcome email sent with login instructions |
| **Password Setup** | User prompted to set their own password at first login |
| **Reminders** | Automated follow-up emails if setup isn't completed |
| **Completed** | Account fully active, audit trail recorded |

No more chasing clients. No more plain-text passwords. No more guessing where someone is in the process.

---

## Who It's For

### For Business Owners
You get a secure, professional onboarding experience for every new client — with zero manual admin work. Know exactly who has completed setup, who's still pending, and who may have a compromised email address. Your clients get a polished, branded experience from day one.

### For Developers & Agencies
Deploy Homestead for your clients in minutes using a single bash script. It installs everything — Node.js, PostgreSQL, PM2 process management, and auto-deploy webhooks — on any Linux server. Generate a fully branded PDF onboarding guide for your client's end-users in seconds. Ship a production-ready onboarding system as part of every WordPress engagement.

---

## Screenshots

### First-Run Setup Wizard
After deployment, a three-step setup wizard walks you through creating your admin account. No config files to edit manually.

<table>
<tr>
<td width="33%"><img src="images_github/Screenshot 2026-03-22 160139.png" alt="Setup Step 1 — PIN Verification" /><br><sub><b>Step 1:</b> Enter the setup PIN chosen during installation</sub></td>
<td width="33%"><img src="images_github/Screenshot 2026-03-22 160205.png" alt="Setup Step 2 — Create Admin Account" /><br><sub><b>Step 2:</b> Create your admin account — name, email, and password</sub></td>
<td width="33%"><img src="images_github/Screenshot 2026-03-22 160236.png" alt="Setup Step 3 — Account Created" /><br><sub><b>Step 3:</b> Account created — restart the app and go to login</sub></td>
</tr>
</table>

---

### Admin Dashboard
A clean dashboard gives you full visibility into your onboarding pipeline. Filter by status, search across all users, run breach rechecks, and sync new users — all in one place. On first login, a Getting Started checklist guides you through completing configuration.

<table>
<tr>
<td width="50%"><img src="images_github/Screenshot 2026-03-22 172849.png" alt="Dashboard with Getting Started checklist" /><br><sub>First login — Getting Started checklist guides you through SMTP, WordPress, and sync setup</sub></td>
<td width="50%"><img src="images_github/Screenshot 2026-03-22 170957.png" alt="Dashboard — users synced" /><br><sub>Dashboard with users synced — pipeline stats, filters, and search ready to use</sub></td>
</tr>
</table>

---

### Branded Onboarding Guide Generator
Generate a fully branded PDF onboarding guide for your client's end-users in seconds. Enter a site URL — Homestead auto-detects the logo, name, and colors — then produce a polished, print-ready guide explaining the entire onboarding process.

<table>
<tr>
<td width="50%"><img src="images_github/Screenshot 2026-03-22 172906.png" alt="Guide Generator — enter URL and fetch branding" /><br><sub>Enter your site URL and click Fetch Branding — logo and site name are detected automatically</sub></td>
<td width="50%"><img src="images_github/Screenshot 2026-03-22 172936.png" alt="Guide Generator — branding confirmed, ready to generate" /><br><sub>Branding confirmed — site name, support email, and login URL pre-populated, ready to generate</sub></td>
</tr>
</table>

<table>
<tr>
<td width="33%"><img src="images_github/Screenshot 2026-03-22 173025.png" alt="Generated guide — cover page" /><br><sub>Generated PDF cover — "What to Expect When You Register" branded to your client's site</sub></td>
<td width="33%"><img src="images_github/Screenshot 2026-03-22 173036.png" alt="Generated guide — onboarding journey steps" /><br><sub>Step-by-step onboarding journey — registration, breach check, approval, password setup</sub></td>
<td width="33%"><img src="images_github/Screenshot 2026-03-22 173052.png" alt="Generated guide — email examples section" /><br><sub>Email examples section — shows end-users the emails they can expect to receive</sub></td>
</tr>
</table>

---

### Automated Emails — Branded for Your Client
Every email sent to end-users is fully branded to your client's site. Homestead sends up to three emails per user — a security notice if their email appears in a breach, a welcome & activation email, and a friendly reminder if they haven't completed setup.

<table>
<tr>
<td width="33%"><img src="images_github/Screenshot 2026-03-22 173110.png" alt="Email — Security breach notice" /><br><sub><b>Email 1:</b> Security notice — user's email found in a known data breach (sent only if applicable)</sub></td>
<td width="33%"><img src="images_github/Screenshot 2026-03-22 173122.png" alt="Email — Welcome and account activation" /><br><sub><b>Email 2:</b> Welcome — account approved and active, prompts user to log in and set their password</sub></td>
<td width="33%"><img src="images_github/Screenshot 2026-03-22 173159.png" alt="Email — Friendly reminder" /><br><sub><b>Email 3:</b> Friendly reminder — sent automatically if user hasn't completed password setup after a few days</sub></td>
</tr>
</table>

---

### Configuration — Sites & SMTP
Connect multiple sites, manage your SMTP server library, configure email validation, and control all app settings from one place.

<table>
<tr>
<td width="50%"><img src="images_github/Screenshot 2026-03-22 173220.png" alt="Sites configuration" /><br><sub>Sites page — connect your WordPress site and ProfileGrid credentials, test the connection</sub></td>
<td width="50%"><img src="images_github/Screenshot 2026-03-22 173232.png" alt="Settings — SMTP library and App Update" /><br><sub>Settings — configure your SMTP server library and Abstract API email validation key</sub></td>
</tr>
</table>

---

### One-Click Updates
When a new version of Homestead is available, the dashboard notifies you automatically. Hit **Update Now** — the app pulls the latest code, rebuilds, and restarts itself. Your credentials and data are never touched.

<img src="images_github/Screenshot 2026-03-22 162747.png" alt="Update overlay — Updating Homestead with live countdown" width="700" /><br>
<sub>Update overlay — pulls latest code, rebuilds, and auto-reloads when complete. No SSH required.</sub>

---

## Features

- **Multi-site support** — manage onboarding for multiple WordPress sites from one dashboard
- **Three-stage user lifecycle** — `Pending Approval` → `Awaiting Password Change` → `Completed`
- **Automated breach detection** — email addresses checked against public data breach databases on sync
- **Branded guide generator** — auto-detect site branding and produce a print-ready PDF onboarding guide
- **Automated reminder emails** — scheduled follow-ups if users haven't completed setup
- **SMTP server library** — save reusable SMTP configurations, assign per site
- **Abstract API integration** — optional email quality validation and disposable address detection
- **One-click updates** — pull latest code, rebuild, and restart from the dashboard UI
- **Version update notifications** — dashboard alerts you when a newer release is available on GitHub
- **Getting Started checklist** — guides you through configuration after a fresh install
- **First-run setup wizard** — PIN-protected, browser-based credential entry
- **Auto-deploy webhooks** — push to GitHub and the server rebuilds automatically
- **PM2 process management** — survives reboots, restarts on crash, log management included
- **Light & dark mode** — clean, modern UI that works for long sessions

---

## Requirements

- Linux server (Ubuntu 20.04+, Debian 11+, Rocky Linux 8+, RHEL 8+)
- Root or sudo access
- A WordPress site with the [ProfileGrid](https://wordpress.org/plugins/profilegrid-user-profiles-groups-and-communities/) plugin
- An SMTP account for sending emails (Gmail, SendGrid, Postmark, etc.)

> Node.js 20 LTS and PostgreSQL are installed automatically by `deploy.sh` if not already present.

---

## Quick Start

```bash
git clone https://github.com/knmplace/homestead.git
cd homestead
bash deploy.sh
```

`deploy.sh` is fully interactive. It asks a few questions (existing PostgreSQL? existing n8n?), then handles everything else automatically — database creation, app build, PM2 setup, and optional webhook server.

> **Note:** No matter where you clone, the app always installs to `/opt/homestead`. Your clone folder is temporary — you can clone to `/tmp`, your home directory, or anywhere you like.

After deploy, visit your server's IP or domain in a browser. The setup wizard will guide you through creating your admin account.

---

## Updating

From the dashboard: **Settings → App Update → Update Homestead**

The app pulls the latest code, backs up your `.env.local`, runs any new database migrations, rebuilds, and restarts. Your credentials and data are never modified.

Or via SSH:
```bash
bash /opt/homestead-src/update.sh
```

---

## Documentation

| File | Contents |
|------|----------|
| [DEPLOY.md](DEPLOY.md) | Full deployment walkthrough, update.sh usage, manual fallback steps |
| [WORDPRESS_SETUP.md](WORDPRESS_SETUP.md) | WordPress mu-plugin install, Application Password setup |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [ERRORS.md](ERRORS.md) | Known issues, fixes applied, troubleshooting |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend & API | Next.js 15 (App Router) |
| Database | PostgreSQL via Prisma ORM |
| Process Management | PM2 |
| Email | Nodemailer (SMTP) |
| Email Validation | Abstract API (optional) |
| WordPress Integration | ProfileGrid REST API + Application Passwords |
| Deployment | Bash (`deploy.sh`), optional GitHub webhook auto-deploy |

---

## License

MIT — free to use, self-host, and modify.

---

## Contributing

Pull requests welcome. Please open an issue first for significant changes.

---

*Built by [KNMPlace](https://knmplace.com)*
