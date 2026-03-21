# ADOB — Deployment Guide

## Prerequisites

- Linux server with root or sudo access
- One of: Ubuntu 20.04+, Debian 11+, Rocky Linux 8+, RHEL 8+
- A domain name or server IP that your users can reach
- Git installed (`apt install git` or `dnf install git`)

---

## Deployment via deploy.sh (Recommended)

### 1. Clone the repository

```bash
git clone http://your-git-host/your-username/adob.git /opt/adob
cd /opt/adob
```

### 2. Run the installer

```bash
bash deploy.sh
```

The script runs 10 phases automatically. You will be asked a few questions:

**Phase 2 — Infrastructure:**
- Do you have an existing PostgreSQL instance? `(y/N)`
  - **Yes** → enter host, port, database name, user, password (connection is tested immediately)
  - **No** → PostgreSQL is installed and configured automatically
- Do you have an existing n8n instance? `(y/N)`
  - **Yes** → enter your n8n URL and API key (connection is tested)
  - **No** → n8n is installed via Docker and an API key is created automatically

**Phase 3 — App credentials:**
- Required: `NEXT_PUBLIC_APP_URL`, `ACCOUNT_LOGIN_URL`, `SUPPORT_EMAIL`
- Optional (can finish via setup wizard): WordPress credentials, SMTP credentials, Abstract API key

**Phase 9 — Auto-deploy webhook (optional):**
- Skip entirely, or configure for GitHub or Gitea

### 3. Record the Setup PIN

If any credentials were skipped, `deploy.sh` prints an 8-character Setup PIN at the end. **Save this PIN** — it is shown once and not stored in plain text anywhere.

### 4. Complete setup (if needed)

Visit `http://YOUR_SERVER_IP:6001` in your browser. If credentials were skipped, you will be redirected to `/setup`. Enter the PIN to access the setup wizard.

---

## What deploy.sh Does

| Phase | Action |
|-------|--------|
| 0 | Pre-flight: check OS, root/sudo, Docker availability |
| 1 | Install Node.js 20, npm, PM2, Docker (if needed) |
| 2 | PostgreSQL and n8n — existing or local |
| 3 | Collect remaining app credentials |
| 4 | Write `.env.local` (chmod 600), copy app files |
| 5 | `npm install`, `prisma generate`, `prisma db push`, seed default site |
| 6 | `npm run build` |
| 7 | PM2 start, save, systemd boot persistence |
| 8 | Create n8n workflow templates |
| 9 | Optional auto-deploy webhook |
| 10 | Print full summary |

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
CREATE DATABASE adob_db;
CREATE USER adob_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE adob_db TO adob_user;
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

### 7. Create n8n workflow templates

```bash
npm run n8n:create-templates
```

---

## Post-Deployment

### Add your first site

1. Log in at `http://YOUR_SERVER_IP:6001` with your WordPress admin username and Application Password
2. Go to **Sites** → **Add Site**
3. Enter your WordPress site URL — the form auto-derives the remaining fields
4. Test the connection and save

### Install the WordPress mu-plugin

See [WORDPRESS_SETUP.md](WORDPRESS_SETUP.md) for instructions on installing the password-change tracker plugin on your WordPress site.

---

## Environment Variables Reference

See `.env.example` for a full annotated list of all supported variables.

Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | Public URL of this app |
| `ACCOUNT_LOGIN_URL` | Login URL shown to end users in emails |
| `JWT_SECRET` | Session token signing key |
| `N8N_URL` | n8n instance URL |
| `N8N_API_KEY` | n8n API key |
| `WORDPRESS_URL` | WordPress site URL |
| `WORDPRESS_USERNAME` | WordPress admin username |
| `WORDPRESS_APP_PASSWORD` | WordPress Application Password |
| `SMTP_HOST` | SMTP server hostname |
| `SETUP_REQUIRED` | `"true"` enables setup wizard |
| `SETUP_PIN_HASH` | bcrypt hash of setup PIN |

---

## Upgrading

Use `update.sh` for all upgrades — it is safe to run on a live server and preserves all credentials.

### Standard update

```bash
cd /opt/KNM_Onboarding
git pull
bash update.sh
```

`update.sh` will:
1. Detect the existing install and back up `.env.local` to `backups/`
2. Stop PM2 gracefully
3. Rsync code files only — `.env.local`, `node_modules`, `logs`, and `backups` are never touched
4. `npm install` + `npm audit fix` (safe fixes only)
5. `prisma db push` — non-destructive schema migrations only
6. `npm run build`
7. Restart PM2 and the webhook systemd service (if present)

### If auto-deploy webhook is configured

Push to GitHub and the server updates automatically via the webhook.

---

## Troubleshooting

**App won't start:**
```bash
pm2 logs adob
```

**Database connection errors:**
```bash
# Test connection directly
psql "$DATABASE_URL" -c "SELECT 1"
```

**n8n API errors:**
```bash
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows"
```

**Setup wizard won't accept PIN:**
- The PIN is case-sensitive and exactly 8 characters
- If locked out (3 failed attempts), wait 15 minutes or restart the app (`pm2 restart adob`)
