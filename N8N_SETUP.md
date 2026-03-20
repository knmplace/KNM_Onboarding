# ADOB — n8n Setup Guide

ADOB uses n8n for scheduled workflow automation: syncing users from WordPress on a timer, sending reminder emails, and running breach checks. This document explains what n8n does, what you need, and how to configure it.

---

## Why n8n?

ADOB's automation logic runs inside n8n workflows rather than in the app itself. This separation means:
- Schedules survive app restarts independently
- Workflows can be edited visually without code changes
- You can inspect, pause, or re-trigger automation from the n8n UI

---

## What n8n Does for ADOB

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| Sync Pipeline | Every 15 minutes | Pull users from WordPress/ProfileGrid, validate emails, trigger breach alerts |
| Reminder Pipeline | Configurable | Send reminder emails to users who haven't completed onboarding |

`deploy.sh` creates these workflow templates in your n8n instance automatically. When you add a new site, the app duplicates the templates and configures them for that site.

---

## Options: Local Docker vs Remote Instance

### Option A — Let deploy.sh install n8n locally (recommended for single-server setups)

Answer **N** when `deploy.sh` asks "Do you have an existing n8n instance?"

`deploy.sh` will:
1. Pull the `n8nio/n8n:latest` Docker image
2. Start n8n on port 5678 with a persistent data volume at `/opt/n8n-data`
3. Generate an admin password and encryption key
4. Create an API key automatically
5. Set `N8N_URL` and `N8N_API_KEY` in `.env.local`

n8n will be available at `http://YOUR_SERVER_IP:5678` after install.

### Option B — Use an existing n8n instance

Answer **Y** when `deploy.sh` asks "Do you have an existing n8n instance?"

You will need:
- **N8N_URL** — the base URL of your n8n instance (e.g. `https://n8n.yourdomain.com` or `http://192.168.1.x:5678`)
- **N8N_API_KEY** — an API key from your n8n instance

`deploy.sh` tests the connection immediately. If the test fails, it prompts you to re-enter the values.

---

## Getting an n8n API Key

### n8n Cloud
1. Log in at [app.n8n.cloud](https://app.n8n.cloud)
2. Click your avatar (top right) → **Settings**
3. Go to **API** → **Create API Key**
4. Copy the key — it is shown once

### Self-hosted n8n
1. Log in to your n8n instance
2. Click your avatar → **Settings** → **API**
3. Click **Create API Key**
4. Copy the key

The API key needs permission to create, update, and activate workflows.

---

## n8n URL Format

The URL must include the protocol and any path prefix your instance uses:

```
http://localhost:5678/       ← local Docker with no path prefix
http://192.168.1.x:5678/    ← local network, no path prefix
https://n8n.yourdomain.com/ ← public instance with SSL
```

Include the trailing slash. ADOB appends `api/v1/...` to this base.

---

## Firewall Notes

If n8n is on the same server as ADOB, no firewall changes are needed — ADOB calls n8n on localhost.

If n8n is on a separate server, ensure ADOB's server can reach n8n's port (default 5678) over your network.

If you want n8n accessible from a browser on the public internet, you will need to expose port 5678 or set up a reverse proxy (nginx, Caddy) and point a domain at it.

---

## n8n Data Persistence (Local Docker Install)

All n8n data is stored in `/opt/n8n-data` on the host. This directory is bind-mounted into the Docker container. Upgrading n8n (e.g. `docker pull n8nio/n8n:latest && docker compose up -d`) preserves all workflows and credentials.

To back up your n8n data:
```bash
tar czf n8n-backup-$(date +%Y%m%d).tar.gz /opt/n8n-data
```

---

## Troubleshooting

**deploy.sh can't connect to n8n:**
```bash
curl -s -H "X-N8N-API-KEY: your_api_key" http://localhost:5678/api/v1/workflows
```
Should return a JSON list of workflows. If it returns 401, the API key is wrong. If it times out, n8n isn't running or the port is blocked.

**Workflow templates weren't created:**
```bash
cd /opt/adob
npm run n8n:create-templates
```

**n8n Docker container isn't running:**
```bash
docker compose -f /opt/adob/infra/docker-compose.n8n.yml ps
docker compose -f /opt/adob/infra/docker-compose.n8n.yml logs
```
