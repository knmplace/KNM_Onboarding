# Homestead — Known Issues & Deployment Troubleshooting

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

## Issue 9: npm audit vulnerabilities on install

**Symptom:**
After `npm install`, warnings appear:
```
16 vulnerabilities (5 moderate, 11 high)
```

**Root Cause:**
Two production dependencies (`next` and `bcrypt`) had known CVEs. The remaining
vulnerabilities are all in Prisma's internal dev tooling chain (`hono`, `effect`,
`lodash`, `chevrotain`) — never executed in production.

**Fix Applied:**
- `next` bumped to `^16.2.1` — resolves HTTP smuggling, DoS, and CSRF bypass CVEs
- `bcrypt` bumped to `^6.0.0` — resolves `tar` path traversal chain via `@mapbox/node-pre-gyp`
- `deploy.sh` and `update.sh` both run `npm audit fix` (safe only, no `--force`) after `npm install`

**Remaining 11 warnings (intentionally not fixed):**
All in Prisma internal dev tooling — require `--force` to fix which would upgrade
Prisma itself and risk breaking schema behavior. Not reachable in production.

---

## Issue 10: Git remote confusion — adob repo on Gitea vs GitHub

**Symptom:**
Server at `/opt/KNM_Onboarding` clones from GitHub but local pushes were going to
Gitea only — server never received updates.

**Fix Applied:**
- Removed Gitea remote from `b:/Claude_Apps/adob/`
- `origin` is now GitHub only: `https://github.com/knmplace/KNM_Onboarding.git`
- Server pulls from GitHub via `cd /opt/KNM_Onboarding && git pull && bash update.sh`

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

---

## Issue 11: No theme system â€” UI locked to light palette

**Symptom:**
The app had no dark mode and most screens used hard-coded light Tailwind colors, so a theme switch
would have required one-off changes across the UI.

**Root Cause:**
There was no shared theme provider, no persisted user preference, and no semantic light/dark token layer.

**Fix Applied:**
- Added a client-side theme provider with `localStorage` persistence
- Added a sun/moon toggle in the top bar next to the `Sites` button
- Introduced shared light/dark CSS tokens in `src/app/globals.css`
- Updated the dashboard, Sites page, Deleted Users page, login page, setup wizard, user drawer,
  guide modal, and shared table/stat components to use the shared theme layer

**Result:**
Users can switch between light mode and a neutral dark mode, and the preference carries across the main UI.

---

## Issue 12: Setup PIN always "Incorrect" — dotenvx fails to load bcrypt hashes

**Symptom:**
The setup wizard at `/setup` always shows "Incorrect PIN." regardless of what PIN was chosen during `deploy.sh`.

**Root Cause (confirmed via live server SSH):**
Two compounding bugs caused this:

1. **deploy.sh wrote the ecosystem config using `npm start`** instead of `start.mjs`. This meant `start.mjs` (which uses plain `dotenv` to load `.env.local`) never ran. Instead Next.js used its built-in `dotenvx` loader.

2. **dotenvx fails to parse bcrypt hashes.** The bcrypt hash stored in `.env.local` contains `$` characters (e.g. `$2b$10$...`). dotenvx tries to interpolate `$` as variable expansion and silently loads **0 variables** from the entire file. This was confirmed in the PM2 logs: `[dotenvx] injecting env (0) from .env.local`. As a result `process.env.SETUP_PIN_HASH` was `undefined` at runtime and every PIN comparison failed.

**Previous attempted fix:**
The `getPinHashFromFile()` fallback in `verify-pin/route.ts` reads the file directly and strips quotes — this *would* work if the process environment was missing the var. But since dotenvx was also re-running at request time, it was unclear if the fallback was being reached cleanly. The real fix had to address the ecosystem startup.

**Fix Applied:**
- **`deploy.sh` ecosystem template** — changed `script: 'npm', args: 'start'` to `script: '${INSTALL_DIR}/start.mjs'`. `start.mjs` uses plain `dotenv` which correctly loads all 32 vars including the bcrypt hash.
- **PIN hash storage** — moved from `.env.local` (where dotenvx can corrupt it) to a dedicated `.pin-hash` file written with `printf '%s'` (no quoting, no interpolation). `verify-pin/route.ts` reads `.pin-hash` first, falls back to `.env.local` for backwards compat.
- **Live server `.174` hotfixed** — ecosystem config updated and PM2 restarted. Confirmed `start.mjs` now loads 32 vars on startup.

---

## Issue 14: n8n API key auto-creation fails — invalid scopes for n8n v2.12

**Symptom:**
```
[WARN] Could not auto-generate n8n API key.
[WARN] After install: visit http://localhost:5678 → Settings → API Keys → Create.
```
`N8N_API_KEY` ends up as `PLACEHOLDER_CHANGE_ME` in `.env.local`.

**Root Cause:**
The scope names passed to `/rest/api-keys` (`workflow:create`, `workflow:list`, `workflow:activate`, etc.) are not valid in n8n v2.12. When n8n rejects the request the response has no `rawApiKey` field, so the extraction returns empty and deploy.sh falls back to PLACEHOLDER.
Also `expiresAt: 4070908800` (unix timestamp) was passed as an integer — n8n v2 expects `null` for non-expiring keys.

**Fix Applied (deploy.sh):**
- Reduced scopes to the minimal confirmed-working set: `["workflow:read","workflow:write","workflow:execute"]`
- Changed `expiresAt` from unix timestamp integer to `null`
- Switched JSON extraction from `python3` to `node` (always available post-npm-install, eliminates python3 dependency for this step)

**Live server `.174` hotfix:**
Manually ran the 3-step flow (owner already existed → login with `emailOrLdapLoginId` → POST `/rest/api-keys`) and wrote the resulting JWT to `.env.local`, then restarted PM2.

---

## Issue 13: Site seed fails — `null value in column "updated_at"` NOT NULL constraint

**Symptom:**
```
error: null value in column "updated_at" of relation "site" violates not-null constraint
[WARN] Site seed failed — run manually after fixing credentials.
```

**Root Cause:**
Prisma's `@updatedAt` field decorator does **not** add a `DEFAULT NOW()` at the database level — Prisma manages the value entirely in application code (it injects the timestamp before every UPDATE). When `prisma db push` creates the `site` table, `updated_at` is `NOT NULL` but has **no DB-level default**.

`ensure-default-site.js` then runs a raw SQL `INSERT` that does not include `updated_at` in its column list (relying on a DEFAULT that doesn't exist), causing PostgreSQL to reject the row.

The script's own `CREATE TABLE IF NOT EXISTS` block defines `updated_at ... DEFAULT NOW()`, but since Prisma created the table first, the `IF NOT EXISTS` check skips it entirely.

**Fix Applied:**
- Added `ALTER TABLE site ALTER COLUMN updated_at SET DEFAULT NOW()` in `ensure-default-site.js` immediately after the `CREATE TABLE IF NOT EXISTS` block. This is idempotent — safe to run on every deploy whether the table was just created by Prisma or already existed.
- Live server `.174` hotfixed directly via SSH: ran the `ALTER TABLE` then re-ran `ensure-default-site.js` — seed completed successfully (`siteId: 2, ok: true`).

---

## Issue 15: Setup complete → "Restart & Launch" reloads setup page instead of redirecting to /login

**Symptom:**
After clicking "Restart & Launch ADOB" and the app came back up, the browser reloaded `/setup` instead of redirecting to `/login`.

**Root Cause:**
The `useEffect` in `setup/page.tsx` had no dependency guard — it ran on every render including after restart. When the app came back with `SETUP_REQUIRED="false"`, the effect fetched `/api/setup/status`, got `required: false`, and redirected to `/` (not `/login`). Middleware then bounced the unauthenticated request back to `/login` causing a confusing flash.

**Fix Applied:**
- `useEffect` dependency changed to `[step]` and guarded with `if (step !== "pin") return` — so the status check only runs during the initial PIN step, never after setup completes.
- Redirect target changed from `/` to `/login` to skip the middleware bounce.

---

## Issue 16: Setup page Site slug set to invalid value from user input during deploy

**Symptom:**
Dashboard showed `ONBAORDING 101` (with typo) as the site slug instead of a URL-safe slug.

**Root Cause:**
`deploy.sh` prompts for `DEFAULT_SITE_SLUG` with no validation — the user typed the PM2 process name ("ONBAORDING 101") at the slug prompt. `ensure-default-site.js` passed the value through as-is into the DB.

**Fix Applied:**
- Added `slugify()` function in `ensure-default-site.js` that lowercases, strips non-alphanumeric chars, and truncates to 50 chars. Now applied to `DEFAULT_SITE_SLUG` before seeding.
- Live server `.174` hotfixed via direct SQL: `UPDATE site SET slug='onboarding-101' WHERE id=1` and `DEFAULT_SITE_SLUG` updated in `.env.local`.

---

## Issue 17: Build error — `Module not found: Can't resolve '@/generated/prisma'` after AdminUser refactor

**Symptom:**
```
Module not found: Can't resolve '@/generated/prisma'
```
Build failed after adding AdminUser model.

**Root Cause:**
`login/route.ts` and `setup/complete/route.ts` were importing `new PrismaClient()` from `@/generated/prisma` directly instead of using the shared singleton.

**Fix Applied:**
Changed both files to `import { prisma } from "@/lib/db"`.

---

## Issue 18: WordPress credentials required when adding sites — blocks non-WordPress use

**Symptom:**
The Add Site form had `required` on WordPress Username and App Password — impossible to create a site without WordPress credentials.

**Root Cause:**
`siteCreateSchema` in `site-config.ts` had `z.string().trim().min(1)` (required) for both WordPress fields. The form UI also had `required` on the inputs.

**Fix Applied:**
- Changed both fields in `siteCreateSchema` to `.optional().or(z.literal(""))`.
- Changed `input.wordpressUsername.trim()` to `input.wordpressUsername?.trim() || null` in `buildSiteConfigFromInput`.
- Removed `required` from the form inputs and added "(optional)" labels.

---

## Issue 20: Abstract API key stored in .env.local — lost on redeploy, requires restart

**Symptom:**
Saving an Abstract API key via Settings UI wrote to `.env.local` via `fs.writeFileSync`. On a redeploy or `update.sh` run `.env.local` is preserved — but the approach required a process restart for the key to be visible in `process.env`, and was fragile if `.env.local` was ever regenerated.

**Fix Applied (2026-03-22):**
- Added `AppSetting` model to Prisma schema (key/value table: `app_setting`)
- Added `src/lib/app-settings.ts` with `getSetting` / `setSetting` / `deleteSetting` helpers
- `/api/settings/abstract-api` now writes to DB, reads from DB (env var still works as fallback)
- `/api/checklist` checks DB first then env for abstract key status
- `abstract-api.ts` resolves key at call time: env → DB (no module-level constant)
- Key survives redeployments, takes effect immediately, no restart needed

---

## Issue 21: Plugin file name and display name exposed internal implementation details

**Symptom:**
The WordPress plugin was named "Password Change Tracker" (`password-change-tracker.php`) — the name described exactly what it does and how it works, which is unnecessarily informative for a distributable product.

**Fix Applied (2026-03-22):**
- Renamed to `KNM Onboarding Helper` (`knm-onboarding-helper.php`) — branded name tied to the product, not the mechanism
- Plugin header updated: Plugin Name, Author, License fields added per WordPress standards
- Function prefixes changed from `adob_` to `knm_ob_` to match new name
- All download endpoints, install route, and setup page updated to use new name
- PHP source centralized in `src/lib/plugin-source.ts` — single source of truth

---

## Issue 19: App default SMTP changes require app restart — confusing UX

**Symptom:**
After saving App Default SMTP settings, the success message said "Restart the app for changes to take effect" which is confusing — especially since SMTP Library servers (stored in DB) take effect immediately.

**Root Cause:**
App default SMTP is stored in `.env.local` which Next.js reads only at startup. DB-stored servers are read at request time.

**Note / Partial Fix:**
- Clarified the success message to explain the distinction.
- Added UI tip: "Tip: add servers to the library instead — those take effect immediately with no restart needed."
- Full fix (future): migrate app default SMTP to a DB flag (`isDefault` on `SmtpServer`) so it also takes effect immediately.

---

## Issue 22: Clone location creates messy directory in filesystem root

**Symptom:**
When user runs `git clone https://github.com/knmplace/homestead.git` from `/` (server root) and then runs `bash deploy.sh`, a `/homestead` directory is left in the filesystem root even after deploy completes.

**Root Cause:**
deploy.sh installed the app to `/opt/homestead` via rsync but never cleaned up the original clone location. Users running from root end up with both `/homestead` (clone) and `/opt/homestead` (app).

**Fix Applied (deploy.sh v2.3.0):**
deploy.sh now automatically moves the source clone to `/opt/homestead-src` after install. If the original clone was outside `/opt`, it is removed. This ensures a clean filesystem regardless of where the user cloned.

---

## Issue 25: Logo not displaying on login, setup, or dashboard pages

**Symptom:**
`/logo.jpg` shows as broken image on login, setup, and dashboard pages even though
the file exists in `/opt/homestead/public/logo.jpg`.

**Root Cause:**
The middleware was intercepting requests to `/logo.jpg` and redirecting them to
`/setup` (when `SETUP_REQUIRED=true`) or `/login` (auth guard). Two problems:
1. `/logo.jpg` was not in the `PUBLIC_PREFIXES` list
2. The setup redirect check was duplicating the public path logic instead of
   reusing `isPublic()`, so `/logo.jpg` slipped through even after being added
   to PUBLIC_PREFIXES
3. The middleware `matcher` regex did not exclude `.jpg`/`.png` static files

**Fix Applied (middleware.ts v2.3.2):**
- Added `/logo.jpg` and `/logo.png` to `PUBLIC_PREFIXES`
- Refactored setup redirect to use `isPublic()` — single source of truth
- Updated `matcher` regex to exclude all common image extensions

---

## Issue 24: rsync fails after original clone is removed — "No such file or directory (2)"

**Symptom:**
```
rsync: [Receiver] getcwd(): No such file or directory (2)
rsync error: errors selecting input/output files, dirs (code 3)
```

**Root Cause:**
deploy.sh moved the source clone to `/opt/homestead-src` then immediately ran
`rm -rf "$SCRIPT_DIR"` to clean up the original. The shell's current working
directory was still pointing to `$SCRIPT_DIR` (now deleted), so when rsync ran
next it had no valid working directory and failed with code 3.

**Fix Applied (deploy.sh v2.3.1):**
Added `cd "$SRC_DIR"` immediately after the rsync move and before `rm -rf "$SCRIPT_DIR"`.
Shell cwd is now `/opt/homestead-src` before the original is deleted — rsync succeeds.

---

## Issue 23: update.sh referenced old adob paths and names

**Symptom:**
update.sh still looked for `/opt/adob/.env.local`, used `adob` as PM2 name default, and referenced `webhook-adob` systemd service — all wrong after the rename to Homestead.

**Root Cause:**
update.sh was not included in the v2.2.0 rename pass.

**Fix Applied (update.sh v2.3.0):**
Fully rewritten: all `adob` references replaced with `homestead`, install dir updated to `/opt/homestead`, source dir updated to `/opt/homestead-src`, webhook service updated to `webhook-homestead`.
