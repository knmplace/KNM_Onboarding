#!/bin/bash

# Update and Restart Script for ADOB
# Pulls latest changes from git (main branch), rebuilds, and restarts PM2
# PROJECT_DIR and PM2_APP_NAME are set by the deploy.sh installer in .env.local

set -e

PROJECT_DIR="${PROJECT_DIR:-/opt/adob}"
LOGFILE="$PROJECT_DIR/logs/deployment.log"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

# Logging function
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

PM2_APP_NAME="${PM2_APP_NAME:-adob}"

log "========================================="
log "ADOB Deployment Started"
log "========================================="

cd "$PROJECT_DIR"

# Step 1: Fetch latest changes
log "Step 1: Fetching latest changes from git..."
git fetch origin
log "✓ Git fetch completed"

# Step 2: Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log "Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "main" ]; then
  log "ERROR: Not on 'main' branch. Current branch: $CURRENT_BRANCH"
  log "Aborting deployment."
  exit 1
fi

# Step 3: Reset to latest remote
log "Step 2: Resetting to latest remote..."
git reset --hard origin/main
log "✓ Reset to latest remote completed"

# Step 4: Install dependencies
log "Step 3: Installing dependencies..."
npm install --include=dev
log "✓ Dependencies installed"

# Step 5: Generate Prisma client (required after install)
log "Step 4: Generating Prisma client..."
npx prisma generate
log "✓ Prisma client generated"

# Step 6: Clear Next.js build cache
log "Step 5: Clearing Next.js build cache..."
rm -rf "$PROJECT_DIR/.next" 2>/dev/null || true
log "✓ Cache cleared"

# Step 7: Build application
log "Step 6: Building application..."
unset NODE_ENV
npm run build
if [ $? -eq 0 ]; then
  log "✓ Build completed successfully"
else
  log "ERROR: Build failed!"
  exit 1
fi

# Step 8: Restart PM2 process
log "Step 7: Restarting PM2 process..."
pm2 restart "$PM2_APP_NAME"
log "✓ PM2 process restarted"

# Step 9: Display status
log "Step 8: Verifying deployment..."
pm2 status | tee -a "$LOGFILE"

log ""
log "========================================="
log "ADOB Deployment Complete"
log "========================================="
log "Deployment Log: $LOGFILE"
