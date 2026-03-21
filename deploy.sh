#!/bin/bash
# =============================================================================
# ADOB — Automated Deployment & Onboarding Bootstrap
# Self-contained installer for Linux (Ubuntu, Debian, RHEL/Rocky/AlmaLinux)
#
# Usage:
#   bash deploy.sh
#
# What this script does:
#   1. Detects your OS and installs Node.js 20, PM2, Docker (if needed)
#   2. Asks whether you have existing PostgreSQL / n8n instances or want local ones
#   3. Installs and configures them automatically if local is chosen
#   4. Collects remaining app credentials interactively
#   5. Builds and starts the app via PM2
#   6. Optionally sets up a git webhook auto-deploy server
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

prompt()       { read -rp "$(echo -e "${BOLD}$1${RESET} ") " "$2"; }
prompt_secret(){ read -rsp "$(echo -e "${BOLD}$1${RESET} ") " "$2"; echo; }
prompt_yn()    { read -rp "$(echo -e "${BOLD}$1 [y/N]${RESET} ") " _yn; [[ "${_yn,,}" == "y" ]]; }

SETUP_REQUIRED=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Phase 0: Pre-flight ─────────────────────────────────────────────────────
header "ADOB Installer — Pre-flight"

if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root or with sudo."
  exit 1
fi

# Detect OS
if [[ -f /etc/os-release ]]; then
  # shellcheck source=/dev/null
  source /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_LIKE="${ID_LIKE:-}"
  OS_VERSION="${VERSION_ID:-}"
else
  error "Cannot detect OS. /etc/os-release not found."
  exit 1
fi

if [[ "$OS_ID" == "ubuntu" || "$OS_ID" == "debian" || "$OS_LIKE" == *"debian"* ]]; then
  PKG_MGR="apt"
elif [[ "$OS_ID" == "rhel" || "$OS_ID" == "rocky" || "$OS_ID" == "almalinux" || "$OS_ID" == "centos" || "$OS_LIKE" == *"rhel"* ]]; then
  PKG_MGR="dnf"
else
  error "Unsupported OS: $OS_ID. Supported: Ubuntu, Debian, RHEL, Rocky, AlmaLinux."
  exit 1
fi

info "Detected OS: $PRETTY_NAME (package manager: $PKG_MGR)"

echo
echo "This installer will:"
echo "  • Install Node.js 20 LTS, PM2, and Docker (if not present)"
echo "  • Configure PostgreSQL and/or n8n (local or point to existing)"
echo "  • Build and start ADOB on port 6001 (default)"
echo "  • Optionally set up git webhook auto-deploy"
echo

if ! prompt_yn "Continue with installation?"; then
  echo "Installation cancelled."
  exit 0
fi

# ─── Phase 1: System dependencies ────────────────────────────────────────────
header "Phase 1: Installing System Dependencies"

install_nodejs() {
  if command -v node &>/dev/null && node -e "process.exit(parseInt(process.version.slice(1)) >= 20 ? 0 : 1)" 2>/dev/null; then
    success "Node.js $(node --version) already installed."
    return
  fi
  info "Installing Node.js 20 LTS..."
  if [[ "$PKG_MGR" == "apt" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  else
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
  fi
  success "Node.js $(node --version) installed."
}

install_pm2() {
  if command -v pm2 &>/dev/null; then
    success "PM2 already installed."
    return
  fi
  info "Installing PM2..."
  npm install -g pm2
  success "PM2 installed."
}

install_docker() {
  if command -v docker &>/dev/null; then
    success "Docker already installed."
    return
  fi
  info "Installing Docker..."
  if [[ "$PKG_MGR" == "apt" ]]; then
    apt-get update -q
    apt-get install -y ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/${OS_ID}/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/${OS_ID} $(lsb_release -cs) stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -q
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  else
    dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl start docker
    systemctl enable docker
  fi
  success "Docker installed."
}

install_nodejs
install_pm2
install_docker

# ─── Phase 2: Infrastructure selection ───────────────────────────────────────
header "Phase 2: PostgreSQL Configuration"

DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="adob"
DB_USER="adob_user"
DB_PASSWORD=""
INSTALL_LOCAL_PG=false

if prompt_yn "Do you have an existing PostgreSQL instance?"; then
  prompt "  PostgreSQL host (e.g. 192.168.1.100):" DB_HOST
  prompt "  PostgreSQL port [5432]:" DB_PORT_INPUT
  DB_PORT="${DB_PORT_INPUT:-5432}"
  prompt "  Database name [adob]:" DB_NAME_INPUT
  DB_NAME="${DB_NAME_INPUT:-adob}"
  prompt "  Database user [adob_user]:" DB_USER_INPUT
  DB_USER="${DB_USER_INPUT:-adob_user}"
  prompt_secret "  Database password:" DB_PASSWORD

  info "Testing PostgreSQL connection..."
  if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null; then
    success "PostgreSQL connection successful."
  else
    warn "Could not connect to PostgreSQL with provided credentials."
    warn "Installation will continue — you can fix this in .env.local later."
    SETUP_REQUIRED=true
  fi
else
  INSTALL_LOCAL_PG=true
  info "Will install PostgreSQL locally..."
  DB_HOST="localhost"
  DB_PORT="5432"
  DB_NAME="adob"
  DB_USER="adob_user"
  DB_PASSWORD="$(openssl rand -base64 16 | tr -dc 'A-Za-z0-9' | head -c 20)"
fi

# ─── Phase 2b: n8n Configuration ─────────────────────────────────────────────
header "Phase 2b: n8n Configuration"
info "n8n is required for automated user sync and reminder workflows."
info "See N8N_SETUP.md for details."
echo

N8N_URL=""
N8N_API_KEY=""
N8N_BASIC_AUTH_USER=""
N8N_BASIC_AUTH_PASS=""
INSTALL_LOCAL_N8N=false

if prompt_yn "Do you have an existing n8n instance?"; then
  prompt "  n8n URL (e.g. https://n8n.yourdomain.com/):" N8N_URL
  prompt_secret "  n8n API Key:" N8N_API_KEY

  info "Testing n8n connection..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "X-N8N-API-KEY: ${N8N_API_KEY}" "${N8N_URL%/}/api/v1/workflows" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
    success "n8n connection successful."
  else
    warn "Could not reach n8n (HTTP $HTTP_CODE). Check N8N_URL and N8N_API_KEY in .env.local after installation."
    SETUP_REQUIRED=true
  fi
else
  INSTALL_LOCAL_N8N=true
  info "Will install n8n locally via Docker..."
  N8N_PORT="5678"
  N8N_ENCRYPTION_KEY="$(openssl rand -base64 32)"
  N8N_BASIC_AUTH_USER="admin"
  N8N_BASIC_AUTH_PASS="$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 16)"
fi

# ─── Phase 3: App credential collection ───────────────────────────────────────
header "Phase 3: Application Credentials"
info "Press Enter to skip any field. Skipped fields can be configured"
info "via the setup wizard on first login, or in Sites → Edit."
echo

prompt "App port [6001]:" APP_PORT_INPUT
APP_PORT="${APP_PORT_INPUT:-6001}"

prompt "Webhook port [9100]:" WEBHOOK_PORT_INPUT
WEBHOOK_PORT="${WEBHOOK_PORT_INPUT:-9100}"

prompt "Install directory [/opt/adob]:" INSTALL_DIR_INPUT
INSTALL_DIR="${INSTALL_DIR_INPUT:-/opt/adob}"

prompt "PM2 app name [adob]:" PM2_NAME_INPUT
PM2_APP_NAME="${PM2_NAME_INPUT:-adob}"

prompt "Public app URL (e.g. https://onboarding.yourdomain.com):" NEXT_PUBLIC_APP_URL
if [[ -z "$NEXT_PUBLIC_APP_URL" ]]; then
  SERVER_IP=$(hostname -I | awk '{print $1}')
  NEXT_PUBLIC_APP_URL="http://${SERVER_IP}:${APP_PORT}"
  warn "No URL provided — defaulting to http://${SERVER_IP}:${APP_PORT}"
fi

prompt "Default site slug [my-site]:" DEFAULT_SITE_SLUG_INPUT
DEFAULT_SITE_SLUG="${DEFAULT_SITE_SLUG_INPUT:-my-site}"

prompt "Default site name [My Site]:" DEFAULT_SITE_NAME_INPUT
DEFAULT_SITE_NAME="${DEFAULT_SITE_NAME_INPUT:-My Site}"

echo
info "--- WordPress ---"
if prompt_yn "  Do you have WordPress credentials ready?"; then
  prompt   "  WordPress site URL:" WORDPRESS_URL
  prompt   "  WordPress admin username:" WORDPRESS_USERNAME
  prompt_secret "  WordPress Application Password:" WORDPRESS_APP_PASSWORD
  prompt   "  Account login URL shown to users (e.g. https://yoursite.com/login):" ACCOUNT_LOGIN_URL
else
  warn "WordPress credentials skipped — configure via setup wizard or Sites page."
  WORDPRESS_URL="PLACEHOLDER_CHANGE_ME"
  WORDPRESS_USERNAME="PLACEHOLDER_CHANGE_ME"
  WORDPRESS_APP_PASSWORD="PLACEHOLDER_CHANGE_ME"
  ACCOUNT_LOGIN_URL="PLACEHOLDER_CHANGE_ME"
  SETUP_REQUIRED=true
fi

echo
info "--- SMTP Email ---"
if prompt_yn "  Do you have SMTP credentials ready?"; then
  prompt        "  SMTP host:" SMTP_HOST
  prompt        "  SMTP port [465]:" SMTP_PORT_INPUT
  SMTP_PORT="${SMTP_PORT_INPUT:-465}"
  prompt        "  SMTP secure (true/false) [true]:" SMTP_SECURE_INPUT
  SMTP_SECURE="${SMTP_SECURE_INPUT:-true}"
  prompt        "  SMTP username:" SMTP_USERNAME
  prompt_secret "  SMTP password:" SMTP_PASSWORD
  prompt        "  From email address:" SMTP_FROM_EMAIL
  prompt        "  From name:" SMTP_FROM_NAME
  prompt        "  Support email shown to users:" SUPPORT_EMAIL
else
  warn "SMTP credentials skipped — configure via setup wizard or Sites page."
  SMTP_HOST="PLACEHOLDER_CHANGE_ME"
  SMTP_PORT="465"
  SMTP_SECURE="true"
  SMTP_USERNAME="PLACEHOLDER_CHANGE_ME"
  SMTP_PASSWORD="PLACEHOLDER_CHANGE_ME"
  SMTP_FROM_EMAIL="PLACEHOLDER_CHANGE_ME"
  SMTP_FROM_NAME="PLACEHOLDER_CHANGE_ME"
  SUPPORT_EMAIL="PLACEHOLDER_CHANGE_ME"
  SETUP_REQUIRED=true
fi

echo
info "--- Abstract API (Email Validation — Optional) ---"
if prompt_yn "  Do you have an Abstract API key? (sign up free at abstractapi.com)"; then
  prompt_secret "  Abstract API key:" ABSTRACT_API_KEY
else
  warn "Abstract API key skipped — email validation will be unavailable."
  ABSTRACT_API_KEY="PLACEHOLDER_CHANGE_ME"
fi

# Auto-generate secrets
JWT_SECRET="$(openssl rand -base64 32)"
N8N_WEBHOOK_AUTH_KEY="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)"
# ── Setup PIN — user chooses their own ──────────────────────────────────────
# The PIN protects the first-run setup wizard. The user picks it now so they
# know it and we never have to "show it once" or generate something random.
echo
info "Choose a Setup PIN for the first-run configuration wizard."
info "This PIN gates access to /setup where you enter your credentials."
info "Use 6–12 characters — letters and numbers only, no spaces."
echo
SETUP_PIN=""
while true; do
  prompt_secret "  Setup PIN (you choose):" SETUP_PIN
  if [[ ${#SETUP_PIN} -lt 6 ]]; then
    warn "PIN must be at least 6 characters. Try again."
    continue
  fi
  if [[ ! "$SETUP_PIN" =~ ^[A-Za-z0-9]+$ ]]; then
    warn "PIN must contain only letters and numbers. Try again."
    continue
  fi
  prompt_secret "  Confirm PIN:" SETUP_PIN_CONFIRM
  if [[ "$SETUP_PIN" != "$SETUP_PIN_CONFIRM" ]]; then
    warn "PINs do not match. Try again."
    continue
  fi
  break
done
success "Setup PIN confirmed."
# Hash will be computed after npm install (bcrypt must be available)

# ─── Phase 3b: Install local Postgres if needed ───────────────────────────────
if [[ "$INSTALL_LOCAL_PG" == "true" ]]; then
  header "Phase 3b: Installing Local PostgreSQL"

  if [[ "$PKG_MGR" == "apt" ]]; then
    apt-get update -q
    apt-get install -y postgresql postgresql-contrib
  else
    dnf install -y postgresql-server postgresql-contrib
    postgresql-setup --initdb
  fi

  systemctl start postgresql
  systemctl enable postgresql
  # Wait for PostgreSQL to be ready to accept connections
  for i in $(seq 1 12); do
    sleep 2
    if sudo -u postgres psql -c "SELECT 1" >/dev/null 2>&1; then break; fi
    printf "."
  done
  echo
  success "PostgreSQL installed and started."

  # Drop existing DB/user if present (handles re-runs cleanly)
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" 2>/dev/null || true
  sudo -u postgres psql -c "DROP USER IF EXISTS \"${DB_USER}\";" 2>/dev/null || true

  # Create DB and user fresh
  sudo -u postgres psql <<-EOSQL
    CREATE DATABASE "${DB_NAME}";
    CREATE USER "${DB_USER}" WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';
    GRANT ALL PRIVILEGES ON DATABASE "${DB_NAME}" TO "${DB_USER}";
    ALTER DATABASE "${DB_NAME}" OWNER TO "${DB_USER}";
EOSQL
  success "Database '${DB_NAME}' and user '${DB_USER}' created."
fi

# ─── Phase 3c: Install local n8n if needed ───────────────────────────────────
if [[ "$INSTALL_LOCAL_N8N" == "true" ]]; then
  header "Phase 3c: Installing Local n8n (Docker)"

  N8N_DATA_DIR="/opt/n8n-data"
  mkdir -p "$N8N_DATA_DIR"
  # n8n container runs as uid 1000 (node user) — must own the data directory
  chown 1000:1000 "$N8N_DATA_DIR"

  # Write docker-compose file
  N8N_COMPOSE_FILE="${INSTALL_DIR}/infra/docker-compose.n8n.yml"
  mkdir -p "${INSTALL_DIR}/infra" 2>/dev/null || true

  # Write to temp location first (INSTALL_DIR may not exist yet)
  TEMP_COMPOSE="/tmp/docker-compose.n8n.yml"
  cat > "$TEMP_COMPOSE" <<EOYML
services:
  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:${N8N_PORT}:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_BASIC_AUTH_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_BASIC_AUTH_PASS}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - N8N_PUBLIC_API_SWAGGERUI_DISABLED=false
      - N8N_LOG_LEVEL=info
    volumes:
      - ${N8N_DATA_DIR}:/home/node/.n8n
EOYML

  # Fix volume ownership BEFORE starting container.
  # n8n runs as uid 1000 (node) inside Docker — the data dir must be owned by 1000.
  chown -R 1000:1000 "$N8N_DATA_DIR"

  # Pull image first so startup poll isn't waiting on a download
  info "Pulling n8n Docker image (this may take a minute)..."
  docker pull n8nio/n8n:latest

  info "Starting n8n container..."
  docker compose -f "$TEMP_COMPOSE" up -d

  # Wait for n8n to be healthy — up to 3 minutes
  info "Waiting for n8n to be ready..."
  N8N_READY=false
  for i in $(seq 1 36); do
    sleep 5
    printf "."
    if curl -sf "http://localhost:${N8N_PORT}/healthz" 2>/dev/null | grep -q "ok"; then
      N8N_READY=true
      break
    fi
  done
  echo

  if [[ "$N8N_READY" == "true" ]]; then
    success "n8n is running at http://localhost:${N8N_PORT}"

    # Give n8n 5 extra seconds to fully initialize internal services
    sleep 5

    # ── Step 1: Complete n8n owner setup (required before API key creation) ──
    # n8n v2+ requires owner account setup before the API is usable.
    # The /rest/owner/setup endpoint creates the owner without needing prior auth.
    N8N_OWNER_EMAIL="admin@adob.local"
    SETUP_RESP=$(curl -s -X POST "http://localhost:${N8N_PORT}/rest/owner/setup" \
      -H "Content-Type: application/json" \
      -c /tmp/n8n_session.txt \
      -d "{\"email\":\"${N8N_OWNER_EMAIL}\",\"firstName\":\"Admin\",\"lastName\":\"User\",\"password\":\"${N8N_BASIC_AUTH_PASS}\"}" 2>/dev/null || echo "{}")

    # ── Step 2: Login to get session cookie ──
    LOGIN_RESP=$(curl -s -X POST "http://localhost:${N8N_PORT}/rest/login" \
      -H "Content-Type: application/json" \
      -c /tmp/n8n_session.txt \
      -b /tmp/n8n_session.txt \
      -d "{\"emailOrLdapLoginId\":\"${N8N_OWNER_EMAIL}\",\"password\":\"${N8N_BASIC_AUTH_PASS}\"}" 2>/dev/null || echo "{}")

    # ── Step 3: Create API key via /rest/api-keys (n8n v2+ endpoint) ──
    # expiresAt: 4070908800 = year 2099 (effectively non-expiring)
    KEY_RESP=$(curl -s -X POST "http://localhost:${N8N_PORT}/rest/api-keys" \
      -H "Content-Type: application/json" \
      -b /tmp/n8n_session.txt \
      -d '{"label":"ADOB Deploy Key","scopes":["workflow:read","workflow:write","workflow:create","workflow:delete","workflow:execute","workflow:list","workflow:activate","workflow:deactivate","execution:read","execution:list","tag:read","tag:list"],"expiresAt":4070908800}' \
      2>/dev/null || echo "{}")
    rm -f /tmp/n8n_session.txt

    # Extract rawApiKey (the full JWT token used for X-N8N-API-KEY header)
    N8N_API_KEY=$(echo "$KEY_RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('data', {}).get('rawApiKey', ''))
except:
    print('')
" 2>/dev/null || echo "")

    if [[ -z "$N8N_API_KEY" ]]; then
      warn "Could not auto-generate n8n API key."
      warn "After install: visit http://localhost:${N8N_PORT} → Settings → API Keys → Create."
      warn "Then update .env.local: N8N_API_KEY=\"your-key\" and run: pm2 restart ${PM2_APP_NAME}"
      N8N_API_KEY="PLACEHOLDER_CHANGE_ME"
      SETUP_REQUIRED=true
    else
      success "n8n API key created automatically."
    fi
    rm -f /tmp/n8n_session.txt
    N8N_URL="http://localhost:${N8N_PORT}/"
  else
    warn "n8n did not start in time (3 min timeout)."
    warn "Check logs: docker logs \$(docker ps -a --filter name=n8n -q | head -1)"
    warn "Common fix: chown -R 1000:1000 ${N8N_DATA_DIR} && docker restart <container>"
    warn "Once n8n is running, add to .env.local:"
    warn "  N8N_URL=\"http://localhost:${N8N_PORT}/\""
    warn "  N8N_API_KEY=\"your-key\""
    N8N_URL="http://localhost:${N8N_PORT}/"
    N8N_API_KEY="PLACEHOLDER_CHANGE_ME"
    SETUP_REQUIRED=true
  fi
fi

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
INTERNAL_API_BASE="${NEXT_PUBLIC_APP_URL}"

# ─── Phase 4: Install app ─────────────────────────────────────────────────────
header "Phase 4: Installing ADOB"

# Copy app files to install dir (deploy.sh lives in the project root)
if [[ "$SCRIPT_DIR" != "$INSTALL_DIR" ]]; then
  info "Copying app files to ${INSTALL_DIR}..."
  mkdir -p "$INSTALL_DIR"
  rsync -a --exclude='.git' --exclude='node_modules' --exclude='.next' \
    --exclude='.env.local' --exclude='.env' --exclude='logs' --exclude='backups' \
    "${SCRIPT_DIR}/" "${INSTALL_DIR}/"
  success "Files copied."
else
  info "Running from install directory — skipping copy."
fi

# Copy n8n compose file to final location
if [[ "$INSTALL_LOCAL_N8N" == "true" && -f "$TEMP_COMPOSE" ]]; then
  cp "$TEMP_COMPOSE" "${INSTALL_DIR}/infra/docker-compose.n8n.yml"
fi

mkdir -p "${INSTALL_DIR}/logs"
cd "$INSTALL_DIR"

# ─── Write .env.local ────────────────────────────────────────────────────────
info "Writing .env.local..."
SETUP_REQ_VAL="false"
[[ "$SETUP_REQUIRED" == "true" ]] && SETUP_REQ_VAL="true"

cat > "${INSTALL_DIR}/.env.local" <<ENVEOF
# ADOB Environment — generated by deploy.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# File permissions: 600 (owner read/write only)

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL="${DATABASE_URL}"

# ── n8n ───────────────────────────────────────────────────────────────────────
N8N_URL="${N8N_URL}"
N8N_API_KEY="${N8N_API_KEY}"

# ── WordPress / ProfileGrid ───────────────────────────────────────────────────
WORDPRESS_URL="${WORDPRESS_URL}"
WORDPRESS_USERNAME="${WORDPRESS_USERNAME}"
WORDPRESS_APP_PASSWORD="${WORDPRESS_APP_PASSWORD}"
WORDPRESS_REST_API_URL="${WORDPRESS_URL}/wp-json/wp/v2"
PROFILEGRID_API_URL="${WORDPRESS_URL}/wp-json/profilegrid/v1"

# ── SMTP ──────────────────────────────────────────────────────────────────────
SMTP_HOST="${SMTP_HOST}"
SMTP_PORT="${SMTP_PORT}"
SMTP_SECURE="${SMTP_SECURE}"
SMTP_USERNAME="${SMTP_USERNAME}"
SMTP_PASSWORD="${SMTP_PASSWORD}"
SMTP_FROM_EMAIL="${SMTP_FROM_EMAIL}"
SMTP_FROM_NAME="${SMTP_FROM_NAME}"

# ── Email / Support ───────────────────────────────────────────────────────────
SUPPORT_EMAIL="${SUPPORT_EMAIL}"
ACCOUNT_LOGIN_URL="${ACCOUNT_LOGIN_URL}"

# ── Abstract API ──────────────────────────────────────────────────────────────
ABSTRACT_API_KEY="${ABSTRACT_API_KEY}"

# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL}"
DEFAULT_SITE_SLUG="${DEFAULT_SITE_SLUG}"
DEFAULT_SITE_NAME="${DEFAULT_SITE_NAME}"
SECURE_COOKIES="false"
INTERNAL_ONBOARDING_API_BASE="${INTERNAL_API_BASE}"

# ── Security ──────────────────────────────────────────────────────────────────
JWT_SECRET="${JWT_SECRET}"
N8N_WEBHOOK_AUTH_KEY="${N8N_WEBHOOK_AUTH_KEY}"
WEBHOOK_SECRET="${WEBHOOK_SECRET_VAL:-}"

# ── Deployment ────────────────────────────────────────────────────────────────
APP_PORT="${APP_PORT}"
WEBHOOK_PORT="${WEBHOOK_PORT}"
PM2_APP_NAME="${PM2_APP_NAME}"
PROJECT_DIR="${INSTALL_DIR}"
SETUP_REQUIRED="${SETUP_REQ_VAL}"
ENVEOF

chmod 600 "${INSTALL_DIR}/.env.local"
success ".env.local written (permissions: 600)."

# ─── Phase 5: npm install & Prisma ───────────────────────────────────────────
info "Installing npm dependencies..."
npm install --include=dev
success "Dependencies installed."

# Run safe audit fixes (no --force — never allow breaking changes during deploy)
info "Running npm audit fix (safe fixes only)..."
npm audit fix --audit-level=high 2>&1 | grep -v "^npm warn" || true
success "Audit fix complete."

# Now bcrypt is available — hash the user-chosen PIN.
# IMPORTANT: bcrypt hashes contain $ characters (e.g. $2b$10$...).
# Strategy: write the hash to a dedicated .pin-hash file (not .env.local) so dotenvx
# never touches it and shell quoting is irrelevant. The app reads this file directly.
info "Hashing setup PIN..."
SETUP_PIN_HASH="$(node -e "const b=require('bcrypt');process.stdout.write(b.hashSync('${SETUP_PIN}',10));" 2>/dev/null)"
if [[ -z "$SETUP_PIN_HASH" ]]; then
  error "Failed to hash setup PIN. Check bcrypt installation."
  exit 1
fi
# Write hash to dedicated file — no quoting, no dotenvx interpolation issues.
printf '%s' "$SETUP_PIN_HASH" > "${INSTALL_DIR}/.pin-hash"
chmod 600 "${INSTALL_DIR}/.pin-hash"
success "Setup PIN hash written to .pin-hash (bcrypt \$ chars safe from shell/dotenvx)."

info "Generating Prisma client..."
npx prisma generate

info "Running database migrations..."
# Export DATABASE_URL into the current shell so Prisma can read it
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
npx prisma db push --accept-data-loss

info "Seeding default site..."
node scripts/ensure-default-site.js && success "Default site seeded." || warn "Site seed failed — run manually after fixing credentials."

# ─── Phase 6: Build ──────────────────────────────────────────────────────────
header "Phase 6: Building ADOB"
unset NODE_ENV
npm run build
success "Build complete."

# ─── Phase 7: PM2 ────────────────────────────────────────────────────────────
header "Phase 7: Starting App with PM2"

# Write finalized ecosystem config.
# IMPORTANT: use start.mjs (not 'npm start') so that dotenv (not dotenvx) loads
# .env.local before Next.js starts. dotenvx cannot parse bcrypt $ chars and loads
# 0 variables, which means SETUP_PIN_HASH and other vars are missing at runtime.
cat > "${INSTALL_DIR}/ecosystem.linux.config.js" <<ECOEOF
module.exports = {
  apps: [{
    name: '${PM2_APP_NAME}',
    script: '${INSTALL_DIR}/start.mjs',
    cwd: '${INSTALL_DIR}',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: ${APP_PORT},
    },
    error_file: '${INSTALL_DIR}/logs/error.log',
    out_file: '${INSTALL_DIR}/logs/out.log',
    log_file: '${INSTALL_DIR}/logs/combined.log',
    time: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 3000,
  }],
};
ECOEOF

pm2 start "${INSTALL_DIR}/ecosystem.linux.config.js"
pm2 save

# Enable PM2 on boot
STARTUP_CMD=$(pm2 startup systemd -u root --hp /root 2>&1 | grep "sudo env" | head -1)
if [[ -n "$STARTUP_CMD" ]]; then
  eval "$STARTUP_CMD" || warn "Could not auto-configure PM2 startup. Run manually: pm2 startup"
fi

success "ADOB started via PM2 as '${PM2_APP_NAME}'."

# ─── Phase 8: n8n workflow templates ─────────────────────────────────────────
header "Phase 8: Creating n8n Workflow Templates"
if [[ -n "$N8N_API_KEY" && "$N8N_API_KEY" != "PLACEHOLDER_CHANGE_ME" ]]; then
  node scripts/create-n8n-workflow-templates.js && success "n8n templates created." || warn "Template creation failed — run 'npm run n8n:create-templates' manually."
else
  warn "n8n not configured — skipping workflow template creation."
  warn "Run 'npm run n8n:create-templates' after configuring N8N_URL and N8N_API_KEY."
fi

# ─── Phase 9: Optional webhook auto-deploy ───────────────────────────────────
header "Phase 9: Git Webhook Auto-Deploy (Optional)"

WEBHOOK_SETUP=false
if prompt_yn "Set up automatic deployment from a git repository?"; then
  echo "  1) GitHub"
  echo "  2) Gitea (self-hosted)"
  echo "  3) Skip"
  prompt "  Choose [1-3]:" GIT_PROVIDER

  WEBHOOK_SECRET_VAL=""
  if [[ "$GIT_PROVIDER" == "1" || "$GIT_PROVIDER" == "2" ]]; then
    prompt_secret "  Webhook secret (used to verify incoming webhooks):" WEBHOOK_SECRET_VAL
    WEBHOOK_SETUP=true

    # Create a dedicated low-privilege system user for the webhook service
    if ! id -u adob &>/dev/null; then
      useradd --system --no-create-home --shell /usr/sbin/nologin adob
      success "Created system user 'adob' for webhook service."
    fi
    # Grant adob user read access to .env.local (owned by root, 600)
    # by creating a group-readable copy — simpler: just set group adob + 640
    chown root:adob "${INSTALL_DIR}/.env.local"
    chmod 640 "${INSTALL_DIR}/.env.local"

    # Write systemd service
    SERVICE_NAME="webhook-adob"
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<SVCEOF
[Unit]
Description=ADOB Git Webhook Server
After=network.target

[Service]
Type=simple
User=adob
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node ${INSTALL_DIR}/scripts/webhook-server.js
Environment=WEBHOOK_PORT=${WEBHOOK_PORT}
Environment=PROJECT_DIR=${INSTALL_DIR}
Environment=PM2_APP_NAME=${PM2_APP_NAME}
EnvironmentFile=-${INSTALL_DIR}/.env.local
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}.service"
    systemctl start "${SERVICE_NAME}.service"
    success "Webhook server started on port ${WEBHOOK_PORT}."

    SERVER_IP=$(hostname -I | awk '{print $1}')
    if [[ "$GIT_PROVIDER" == "1" ]]; then
      echo
      echo -e "${BOLD}GitHub Webhook Setup:${RESET}"
      echo "  Go to your repo → Settings → Webhooks → Add webhook"
      echo "  Payload URL: http://${SERVER_IP}:${WEBHOOK_PORT}/webhook"
      echo "  Content type: application/json"
      echo "  Secret: (the secret you just entered)"
      echo "  Events: Just the push event"
    else
      echo
      echo -e "${BOLD}Gitea Webhook Setup:${RESET}"
      echo "  Go to your repo → Settings → Webhooks → Add webhook → Gitea"
      echo "  Target URL: http://${SERVER_IP}:${WEBHOOK_PORT}/webhook"
      echo "  Secret: (the secret you just entered)"
      echo "  Trigger On: Push Events"
    fi
  fi
fi

# ─── Phase 10: Summary ───────────────────────────────────────────────────────
header "Deployment Complete"

SERVER_IP=$(hostname -I | awk '{print $1}')

echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║        ADOB Successfully Deployed        ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  App URL:        ${BOLD}${NEXT_PUBLIC_APP_URL}${RESET}"
echo -e "  App Port:       ${BOLD}${APP_PORT}${RESET}"
echo -e "  PM2 Process:    ${BOLD}${PM2_APP_NAME}${RESET}"
echo -e "  Install Dir:    ${BOLD}${INSTALL_DIR}${RESET}"
echo -e "  Database:       ${BOLD}postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}${RESET}"
if [[ "$INSTALL_LOCAL_N8N" == "true" ]]; then
  echo -e "  n8n:            ${BOLD}http://${SERVER_IP}:${N8N_PORT}${RESET} (local Docker)"
  echo -e "  n8n Login:      ${BOLD}${N8N_BASIC_AUTH_USER} / ${N8N_BASIC_AUTH_PASS}${RESET}"
else
  echo -e "  n8n:            ${BOLD}${N8N_URL}${RESET}"
fi
echo

if [[ "$SETUP_REQUIRED" == "true" ]]; then
  echo -e "${YELLOW}${BOLD}"
  echo "  ⚠  SETUP WIZARD REQUIRED"
  echo -e "${RESET}"
  echo "  Some credentials were skipped. Before using ADOB, visit:"
  echo -e "  ${BOLD}${NEXT_PUBLIC_APP_URL}/setup${RESET}"
  echo
  echo "  Use the Setup PIN you chose during this installation to log in."
  echo
else
  echo "  Login with your WordPress admin username and Application Password."
  echo -e "  ${BOLD}${NEXT_PUBLIC_APP_URL}/login${RESET}"
fi

echo
echo "  Next steps:"
echo "  1. Install the WordPress mu-plugin (see WORDPRESS_SETUP.md)"
echo "  2. Add your first managed site at ${NEXT_PUBLIC_APP_URL}/sites"
echo "  3. n8n workflows are created automatically when you add a site"
echo
echo "  Logs: pm2 logs ${PM2_APP_NAME}"
echo "  Docs: ${INSTALL_DIR}/DEPLOY.md"
echo
