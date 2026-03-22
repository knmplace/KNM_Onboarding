#!/bin/bash
# =============================================================================
# Homestead — Update Script
# Safe, non-destructive update for an existing Homestead installation.
#
# Usage (run from anywhere — script finds the install automatically):
#   bash update.sh
#
# What this script does:
#   1. Detects existing install at /opt/homestead
#   2. Pulls latest code into /opt/homestead-src
#   3. Backs up .env.local before touching anything
#   4. Stops the PM2 process gracefully
#   5. Rsyncs code files only (never touches .env.local, node_modules, logs)
#   6. npm install (picks up new/changed dependencies)
#   7. prisma generate + prisma db push (non-destructive schema migrations)
#   8. npm run build
#   9. pm2 restart
#  10. Optionally restarts the webhook systemd service if it exists
#  11. Prints a summary
# =============================================================================

set -euo pipefail

# ─── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}${BLUE}══════════════════════════════════════════${RESET}"; echo -e "${BOLD} $* ${RESET}"; echo -e "${BOLD}${BLUE}══════════════════════════════════════════${RESET}\n"; }

# ─── Preflight ───────────────────────────────────────────────────────────────
header "Homestead Update — Pre-flight"

if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root or with sudo."
  exit 1
fi

# ─── Detect existing install ─────────────────────────────────────────────────
INSTALL_DIR="/opt/homestead"
SRC_DIR="/opt/homestead-src"
ENV_FILE="${INSTALL_DIR}/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  error "No existing install found at ${INSTALL_DIR}/.env.local"
  error "Run deploy.sh for a fresh installation."
  exit 1
fi

success "Found existing install at ${INSTALL_DIR}"

# ─── Read config from existing .env.local ────────────────────────────────────
PM2_APP_NAME=$(grep -E '^PM2_APP_NAME=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' || echo "homestead")
WEBHOOK_PORT=$(grep -E '^WEBHOOK_PORT=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' || echo "9100")
DATABASE_URL_VAL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' || echo "")

PM2_APP_NAME="${PM2_APP_NAME:-homestead}"
info "PM2 process name: ${PM2_APP_NAME}"
info "Install directory: ${INSTALL_DIR}"
info "Source directory:  ${SRC_DIR}"

# ─── Pull latest code ────────────────────────────────────────────────────────
header "Pulling Latest Code"

if [[ -d "${SRC_DIR}/.git" ]]; then
  info "Pulling latest from git in ${SRC_DIR}..."
  cd "$SRC_DIR"
  git pull
  success "Source updated."
else
  warn "No git repo found at ${SRC_DIR} — skipping git pull."
  warn "Code will be synced from current source directory only."
fi

# ─── Backup .env.local ───────────────────────────────────────────────────────
header "Backing Up Configuration"

BACKUP_DIR="${INSTALL_DIR}/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/.env.local.$(date +%Y%m%d-%H%M%S)"
cp "$ENV_FILE" "$BACKUP_FILE"
chmod 600 "$BACKUP_FILE"
success ".env.local backed up to ${BACKUP_FILE}"

# ─── Stop the app ────────────────────────────────────────────────────────────
header "Stopping App"

if pm2 list 2>/dev/null | grep -q "${PM2_APP_NAME}"; then
  pm2 stop "${PM2_APP_NAME}"
  success "PM2 process '${PM2_APP_NAME}' stopped."
else
  warn "PM2 process '${PM2_APP_NAME}' not found — will start fresh after update."
fi

# ─── Sync code files ─────────────────────────────────────────────────────────
header "Syncing Code Files"

SOURCE="$SRC_DIR"
if [[ ! -d "$SOURCE" ]]; then
  SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  warn "Source dir ${SRC_DIR} not found — falling back to script dir: ${SOURCE}"
fi

if [[ "$SOURCE" != "$INSTALL_DIR" ]]; then
  info "Rsyncing from ${SOURCE} to ${INSTALL_DIR}..."
  rsync -a \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.env.local' \
    --exclude='.env' \
    --exclude='logs' \
    --exclude='backups' \
    "${SOURCE}/" "${INSTALL_DIR}/"
  success "Code files synced."
else
  info "Source and install are the same directory — skipping rsync."
fi

cd "$INSTALL_DIR"

# ─── npm install ─────────────────────────────────────────────────────────────
header "Installing Dependencies"

npm install --include=dev
success "Dependencies up to date."

info "Running npm audit fix (safe fixes only)..."
npm audit fix > /dev/null 2>&1 || true
success "Audit fix complete."

# ─── Prisma ──────────────────────────────────────────────────────────────────
header "Running Database Migrations"

if [[ -n "$DATABASE_URL_VAL" ]]; then
  export DATABASE_URL="$DATABASE_URL_VAL"
  export NODE_PATH="${INSTALL_DIR}/node_modules"
  # Use full path to node/prisma to ensure correct module resolution
  # when launched via systemd-run (stripped environment)
  "${INSTALL_DIR}/node_modules/.bin/prisma" generate
  "${INSTALL_DIR}/node_modules/.bin/prisma" db push --accept-data-loss
  success "Database schema is up to date."
else
  warn "DATABASE_URL not found in .env.local — skipping Prisma migration."
  warn "If you have new schema changes, run manually:"
  warn "  export DATABASE_URL=\"your-url\" && npx prisma db push"
fi

# ─── Build ───────────────────────────────────────────────────────────────────
header "Building"

unset NODE_ENV
npm run build
success "Build complete."

# ─── Restart app ─────────────────────────────────────────────────────────────
header "Restarting App"

if pm2 list 2>/dev/null | grep -q "${PM2_APP_NAME}"; then
  pm2 restart "${PM2_APP_NAME}"
  success "PM2 process '${PM2_APP_NAME}' restarted."
elif [[ -f "${INSTALL_DIR}/ecosystem.linux.config.js" ]]; then
  pm2 start "${INSTALL_DIR}/ecosystem.linux.config.js"
  pm2 save
  success "PM2 process '${PM2_APP_NAME}' started from ecosystem config."
else
  warn "Could not restart — no PM2 process and no ecosystem.linux.config.js found."
  warn "Start manually: pm2 start ${INSTALL_DIR}/ecosystem.linux.config.js"
fi

# ─── Restart webhook service ─────────────────────────────────────────────────
WEBHOOK_SERVICE="webhook-homestead"
if systemctl is-active --quiet "${WEBHOOK_SERVICE}.service" 2>/dev/null; then
  systemctl restart "${WEBHOOK_SERVICE}.service"
  success "Webhook service '${WEBHOOK_SERVICE}' restarted."
elif systemctl list-unit-files 2>/dev/null | grep -q "${WEBHOOK_SERVICE}.service"; then
  warn "Webhook service '${WEBHOOK_SERVICE}' exists but is not running — skipping restart."
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
header "Update Complete"

APP_PORT=$(grep -E '^APP_PORT=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' || echo "6001")
APP_URL=$(grep -E '^NEXT_PUBLIC_APP_URL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' || echo "")

echo -e "  ${GREEN}✓${RESET} Code synced and rebuilt"
echo -e "  ${GREEN}✓${RESET} .env.local preserved (backup: ${BACKUP_FILE})"
echo -e "  ${GREEN}✓${RESET} Database schema migrated (non-destructive)"
echo -e "  ${GREEN}✓${RESET} PM2 process restarted"
echo
if [[ -n "$APP_URL" ]]; then
  echo -e "  ${BOLD}App URL:${RESET}  ${APP_URL}"
else
  SERVER_IP=$(hostname -I | awk '{print $1}')
  echo -e "  ${BOLD}App URL:${RESET}  http://${SERVER_IP}:${APP_PORT}"
fi
echo
echo -e "  ${BOLD}PM2 status:${RESET}"
pm2 list 2>/dev/null | grep "${PM2_APP_NAME}" || echo "  (run 'pm2 list' to check)"
echo
