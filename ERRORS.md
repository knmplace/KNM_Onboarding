# ADOB — Known Issues & Deployment Troubleshooting

This file tracks errors encountered during testing and the solutions applied.
Updated as new issues are discovered.

---

## Issue 1: `prisma db push` fails — "datasource.url is required"

**Symptom:**
```
Error: The datasource.url property is required in your Prisma config file when using prisma db push.
```

**Root Cause:**
`prisma.config.ts` uses `import "dotenv/config"` which only auto-loads `.env`, not `.env.local`.
`DATABASE_URL` was written to `.env.local` by deploy.sh but never exported into the shell environment,
so Prisma never saw it.

**Fix Applied (deploy.sh):**
Added `export DATABASE_URL="postgresql://..."` directly in the shell before `npx prisma db push`.
Shell environment variables take priority over dotenv file loading.

---

## Issue 2: PostgreSQL authentication fails on re-run

**Symptom:**
```
Error: P1000 Authentication failed against database server, the provided database credentials
for 'adob_user' are not valid.
```

**Root Cause:**
Running `deploy.sh` a second time generates a new random `DB_PASSWORD` and writes it to `.env.local`,
but the existing `adob_user` in PostgreSQL still has the old password from the first run. Mismatch.

**Fix Applied (deploy.sh):**
Added `DROP DATABASE IF EXISTS` and `DROP USER IF EXISTS` before the CREATE statements.
Every run now starts with a clean slate so the password in `.env.local` always matches PostgreSQL.

---

## Issue 3: PostgreSQL not ready when CREATE USER runs

**Symptom:**
Intermittent failures on the `CREATE DATABASE` / `CREATE USER` step immediately after
`systemctl start postgresql`.

**Root Cause:**
`systemctl start` returns as soon as the service process spawns — PostgreSQL may not be
accepting connections yet.

**Fix Applied (deploy.sh):**
Added a poll loop after `systemctl start postgresql` that runs `psql -c "SELECT 1"` every 2 seconds
for up to 24 seconds before proceeding.

---

## Issue 4: n8n Docker container times out during health check

**Symptom:**
```
[WARN] n8n did not start in time. Check 'docker logs' and configure N8N_URL manually.
```

**Root Cause — Attempt 1:**
Original health poll was 18 × 5s = 90 seconds. On a first run, Docker must pull the n8n image
(~300MB) AND start the container within that window. Not enough time.

**Fix Attempt 1:** Extended poll to 36 × 5s = 3 minutes.
**Result:** Still timing out — image pull was consuming most of the 3 minutes.

**Root Cause — Attempt 2:**
Image pull was happening inside the `docker compose up` call, consuming poll time.

**Fix Attempt 2 (current):** Added explicit `docker pull n8nio/n8n:latest` before `docker compose up -d`.
Image is fully downloaded before the health poll starts, so 3 minutes measures actual startup only.
**Result:** Testing in progress.

**Manual workaround if n8n still fails:**
```bash
# Check what's wrong
docker logs tmp-n8n-1

# Once n8n is running, add to /opt/adob/.env.local:
N8N_URL="http://localhost:5678/"
N8N_API_KEY="your-key-from-n8n-ui"

# Restart app to pick up new values
pm2 restart adob
```
To get an API key manually: visit `http://YOUR_SERVER_IP:5678` → Settings → API Keys → Create.

---

## Issue 5: n8n API key auto-creation fails silently

**Symptom:**
n8n starts successfully but `N8N_API_KEY` ends up as `PLACEHOLDER_CHANGE_ME` in `.env.local`.

**Root Cause:**
Original code tried to authenticate via session cookie (wrong for n8n basic auth mode),
then POST to `/api/v1/users/api-keys`. Neither endpoint works with basic auth in this flow.

**Fix Applied (deploy.sh):**
Switched to HTTP basic auth (`-u user:pass`) against `/api/v1/user/api-key`.
If this still fails, deploy.sh now prints clear manual instructions with exact steps.

---

## Wipe & Fresh Start (use when re-running deploy.sh from scratch)

```bash
# Stop PM2
pm2 delete adob 2>/dev/null; pm2 save 2>/dev/null

# Remove n8n container and data volume
docker stop tmp-n8n-1 2>/dev/null; docker rm tmp-n8n-1 2>/dev/null
rm -rf /opt/n8n-data

# Drop PostgreSQL DB and user
sudo -u postgres psql -c "DROP DATABASE IF EXISTS adob_db;"
sudo -u postgres psql -c "DROP USER IF EXISTS adob_user;"

# Wipe install directory
rm -rf /opt/adob

# Pull latest fixes and re-run
cd /opt/KNM_Onboarding
git pull
bash deploy.sh
```

---

## Deploy Prompts — Correct Answers for Fresh Local Install

| Prompt | Answer |
|--------|--------|
| Existing PostgreSQL instance? | **N** — install locally |
| Existing n8n instance? | **N** — install locally via Docker |
| App port | **Enter** — defaults to 6001 |
| Webhook port | **Enter** — defaults to 9100 |

---

## Issue 6: Port 6000 reserved by Next.js — app crashes on startup

**Symptom:**
```
Bad port: "6000" is reserved for x11
Read more: https://nextjs.org/docs/messages/reserved-port
```
PM2 shows 0 pid, 0 uptime, restarting every 3 seconds.

**Root Cause:**
Next.js maintains an internal blocklist of reserved ports. Port 6000 is blocked
because it conflicts with the x11 protocol. The app starts, Next.js immediately
rejects the port, and PM2 loops restarting it.

**Fix Applied:**
Changed default app port from **6000 → 6001** across deploy.sh, ecosystem.linux.config.js,
package.json, and all documentation.

**Manual fix on existing install:**
```bash
# Update .env.local
sed -i 's/APP_PORT="6000"/APP_PORT="6001"/' /opt/adob/.env.local

# Restart
pm2 restart ONBOARDING
```

---

## docker-compose `version` warning

**Symptom:**
```
WARN[0000] the attribute `version` is obsolete, it will be ignored
```
**Status:** Harmless warning from newer Docker Compose versions. Does not affect functionality.
Will be removed from `docker-compose.n8n.yml` in a future update.

---

## Issue 7: n8n container keeps restarting — permission denied on `/home/node/.n8n/config`

**Symptom:**
```
Error: EACCES: permission denied, open '/home/node/.n8n/config'
```
Container shows `Restarting (1) X seconds ago` in `docker ps -a`.

**Root Cause:**
`/opt/n8n-data` is created by `mkdir -p` as root. The n8n Docker image runs as uid 1000
(`node` user) inside the container. When the volume is mounted, n8n cannot write its config
file because the directory is owned by root.

**Fix Applied (deploy.sh):**
Added `chown -R 1000:1000 /opt/n8n-data` immediately after `mkdir -p`, before the container
starts. This ensures the n8n user has write access from the very first run.

**Manual fix on existing install:**
```bash
docker stop $(docker ps -a --filter name=n8n -q)
chown -R 1000:1000 /opt/n8n-data
docker start $(docker ps -a --filter name=n8n -q)
```

---

## Issue 8: n8n API key auto-creation fails — `showSetupOnFirstLoad: true`

**Symptom:**
`N8N_API_KEY` ends up as `PLACEHOLDER_CHANGE_ME`. n8n is running and healthy but the API
returns `{"message":"not found"}` or `Internal Server Error` for key creation requests.

**Root Cause:**
n8n v2+ requires an **owner account** to be set up before any API key endpoints work.
Previous deploy.sh used `/api/v1/user/api-key` (wrong path) and HTTP basic auth (wrong auth
method for this flow). The correct flow is:
1. POST to `/rest/owner/setup` to create the owner account (no auth required on first run)
2. POST to `/rest/login` to get a session cookie
3. POST to `/rest/api-keys` with `{label, scopes[], expiresAt}` using the session cookie
4. Extract `data.rawApiKey` from the response (the JWT used as `X-N8N-API-KEY`)

**Fix Applied (deploy.sh):**
Replaced the broken API key creation block with the correct 3-step flow above. Also added
a `chown 1000:1000` before starting the container (Issue 7 fix) since that was preventing
n8n from starting at all, which blocked this flow entirely.
