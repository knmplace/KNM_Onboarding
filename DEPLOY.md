# Homestead — Deployment Guide

## Where Does Homestead Install?

**No matter where you clone or run `deploy.sh` from, Homestead always installs to `/opt/homestead`.**

This is intentional. `/opt` is the Linux standard location for self-contained third-party applications. It keeps the app isolated, survives user account changes, and is easy to find for maintenance.

Your clone folder is just a temporary source — the script copies everything to `/opt/homestead` automatically. You can clone to your home directory, `/tmp`, or anywhere else. The final install location is always `/opt/homestead`.

---

## Prerequisites

- Linux server with root or sudo access
- One of: Ubuntu 20.04+, Debian 11+, Rocky Linux 8+, RHEL 8+
- A domain name or server IP that your users can reach
- Git installed (`apt install git` or `dnf install git`)

---

## Quick Start (Recommended)

Clone anywhere and run `deploy.sh` — it handles everything from there:

```bash
git clone https://github.com/knmplace/homestead.git
cd homestead
bash deploy.sh
```

The app will be installed to `/opt/homestead` regardless of where you cloned.

---

## Deployment via deploy.sh

### 1. Clone the repository

Clone to any directory you prefer — your home directory is fine:

```bash
# Option A — home directory (clean, easy)
git clone https://github.com/knmplace/homestead.git ~/homestead
cd ~/homestead

# Option B — directly to /opt (also fine)
git clone https://github.com/knmplace/homestead.git /opt/homestead
cd /opt/homestead

# Either way, the app installs to /opt/homestead
```

### 2. Run the installer

```bash
bash deploy.sh
```

The script runs interactively through several phases. You will be asked:

**Phase 2 — PostgreSQL:**
- Do you have an existing PostgreSQL instance? `(y/N)`
  - **Yes** → enter host, port, database name, user, password (connection is tested immediately)
  - **No** → PostgreSQL is installed and configured automatically

**Phase 3 — App credentials:**
- Public app URL, site name/slug
- WordPress credentials (can skip and finish via setup wizard)
- SMTP credentials (can skip and finish via setup wizard)
- Abstract API key for email validation (optional)
- Setup PIN — you choose this, it protects the first-run setup wizard

**Phase 8 — Auto-deploy webhook (optional):**
- Skip entirely, or configure for GitHub or Gitea

### 3. Complete setup (if needed)

Visit `http://YOUR_SERVER_IP:6001` in your browser. If any credentials were skipped, you will be redirected to `/setup`. Enter the PIN you chose during installation to access the setup wizard.

---

## What deploy.sh Does

| Phase | Action |
|-------|--------|
| 0 | Pre-flight: check OS, root/sudo |
| 1 | Install Node.js 20, npm, PM2 (if needed) |
| 2 | PostgreSQL — existing or local install |
| 3 | Collect app credentials + choose Setup PIN |
| 3b | Install local PostgreSQL if chosen |
| 4 | Copy files to `/opt/homestead`, write `.env.local` (chmod 600) |
| 5 | `npm install`, `prisma generate`, `prisma db push`, seed default site |
| 6 | `npm run build` |
| 7 | PM2 start, save, systemd boot persistence |
| 8 | Optional auto-deploy webhook (systemd service) |
| 9 | Print full deployment summary |

---

## Install Directory Reference

| Path | Purpose |
|------|---------|
| `/opt/homestead` | App install directory (always) |
| `/opt/homestead/.env.local` | Environment variables (chmod 600) |
| `/opt/homestead/.pin-hash` | bcrypt hash of your Setup PIN (chmod 600) |
| `/opt/homestead/logs/` | PM2 log files |
| `/opt/homestead/backups/` | `.env.local` backups created by `update.sh` |
| `/etc/systemd/system/webhook-homestead.service` | Webhook auto-deploy service (if configured) |

---

## Manual Deployment (Advanced)

If you prefer to configure everything by hand:

### 1. Install Node.js 20

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# Rocky Linux / RHEL
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

### 2. Install PM2

```bash
sudo npm install -g pm2
```

### 3. Set up PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql && sudo systemctl enable postgresql

# Create DB and user
sudo -u postgres psql <<SQL
CREATE DATABASE homestead;
CREATE USER homestead_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE homestead TO homestead_user;
ALTER DATABASE homestead OWNER TO homestead_user;
SQL
```

### 4. Configure environment

```bash
cp .env.example .env.local
chmod 600 .env.local
# Edit .env.local and fill in all PLACEHOLDER_CHANGE_ME values
```

### 5. Install dependencies and build

```bash
npm install
npx prisma generate
npx prisma db push
node scripts/ensure-default-site.js
npm run build
```

### 6. Start with PM2

```bash
pm2 start ecosystem.linux.config.js
pm2 save
pm2 startup systemd
# Run the command that pm2 startup prints
```

---

## Post-Deployment

### Add your first site

1. Log in at `http://YOUR_SERVER_IP:6001` with your WordPress admin username and Application Password
2. Go to **Sites** → **Add Site**
3. Enter your WordPress site URL
4. Test the connection and save

### Install the WordPress mu-plugin

See [WORDPRESS_SETUP.md](WORDPRESS_SETUP.md) for instructions on installing the KNM Onboarding Helper plugin on your WordPress site.

---

## Environment Variables Reference

See `.env.example` for a full annotated list. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | Public URL of this app |
| `ACCOUNT_LOGIN_URL` | Login URL shown to end users in emails |
| `JWT_SECRET` | Session token signing key |
| `WORDPRESS_URL` | WordPress site URL |
| `WORDPRESS_USERNAME` | WordPress admin username |
| `WORDPRESS_APP_PASSWORD` | WordPress Application Password |
| `SMTP_HOST` | SMTP server hostname |
| `SETUP_REQUIRED` | `"true"` enables setup wizard on first visit |

---

## Upgrading

Use `update.sh` for all upgrades — safe to run on a live server, preserves all credentials.

```bash
cd /opt/homestead
git pull
bash update.sh
```

`update.sh` will:
1. Back up `.env.local` to `backups/`
2. Stop PM2 gracefully
3. Rsync code files only — `.env.local`, `node_modules`, `logs`, and `backups` are never touched
4. `npm install` + `npm audit fix` (safe fixes only)
5. `prisma db push` — non-destructive schema migrations only
6. `npm run build`
7. Restart PM2 and webhook systemd service (if present)

If auto-deploy webhook is configured, push to GitHub and the server updates automatically.

---

## Troubleshooting

**App won't start:**
```bash
pm2 logs homestead
```

**Database connection errors:**
```bash
psql "$DATABASE_URL" -c "SELECT 1"
```

**Setup wizard won't accept PIN:**
- PIN is case-sensitive, letters and numbers only
- If locked out, restart the app: `pm2 restart homestead`

**Check running processes:**
```bash
pm2 list
systemctl status webhook-homestead.service
```
