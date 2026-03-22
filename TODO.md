# Homestead — Implementation TODO

## Status: COMPLETE ✅

All implementation tasks finished. Build passes clean.

---

## Completed Tasks

- [x] Create project folder `b:/Claude_Apps/adob/`
- [x] Copy and scrub all source files from `onboarding` project
- [x] Remove all KNMPLACE/live credential references from `src/` and `scripts/`
- [x] Create `middleware.ts` — setup wizard redirect interceptor
- [x] Create `src/app/setup/page.tsx` — three-step setup wizard UI
- [x] Create `src/app/api/setup/status/route.ts`
- [x] Create `src/app/api/setup/verify-pin/route.ts`
- [x] Create `src/app/api/setup/complete/route.ts`
- [x] Create `src/app/api/setup/restart/route.ts`
- [x] Create `ecosystem.linux.config.js` — PM2 config reading from env vars
- [x] Create `deploy.sh` — 10-phase interactive installer
- [x] Create `infra/docker-compose.n8n.yml` — local n8n Docker template
- [x] Create `infra/.n8n.env.example`
- [x] Create `scripts/webhook.service.template` — generalized systemd template
- [x] Create `.gitignore` — includes `.mcp.json`, `.env.local`, `PLAN.md`, `TODO.md`
- [x] Create `README.md`
- [x] Create `DEPLOY.md`
- [x] Create `N8N_SETUP.md`
- [x] Create `WORDPRESS_SETUP.md`
- [x] Create `CHANGELOG.md`
- [x] Fix `site.isDefault` — computed from `DEFAULT_SITE_SLUG` env var in API
- [x] Add `bcrypt` + `@types/bcrypt` to `package.json`
- [x] Credential scrub verification — all grep checks pass
- [x] `bash -n deploy.sh` syntax check — PASS
- [x] `npm install && npm run build` — PASS (0 errors, 28 pages)
- [x] File presence/absence checklist — all required files present, all excluded files absent
- [x] Push to GitHub `https://github.com/knmplace/KNM_Onboarding.git`
- [x] Add persisted dark mode with top-bar sun/moon toggle and neutral dark palette
- [x] Refactor core UI screens/components so theme changes apply consistently

---

## Future Roadmap

- **Auto-update on git push** — webhook auto-deploy: when a push lands on GitHub, server pulls and rebuilds automatically (groundwork laid with `/opt/homestead-src` structure in v2.3.0)
- **Migrate App Default SMTP to DB** — move from `.env.local` to `isDefault` flag on `SmtpServer` — eliminates restart requirement (Issue 19)
- **Admin user management UI** — OWNER can invite/manage other ADMIN users from the dashboard
- **CMS abstraction layer** — Directus, Strapi, Supabase adapters; `cmsType` field on site records
- **Abstract API graceful degradation** — UI note when key not set
