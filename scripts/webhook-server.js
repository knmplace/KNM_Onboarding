#!/usr/bin/env node

/**
 * Git Webhook Server (GitHub / Gitea)
 * Listens for push events and automatically updates and restarts the ADOB app.
 * Supports both GitHub (X-Hub-Signature-256) and Gitea (X-Gitea-Signature) webhooks.
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.WEBHOOK_PORT || 9100;
const PROJECT_DIR = process.env.PROJECT_DIR || '/opt/adob';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const LOGFILE = path.join(PROJECT_DIR, 'logs', 'webhook.log');

// Create logs directory if it doesn't exist
const logsDir = path.join(PROJECT_DIR, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Logging utility
function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);

  try {
    fs.appendFileSync(LOGFILE, logMessage + '\n');
  } catch (err) {
    console.error(`Failed to write to log file: ${err.message}`);
  }
}

log('INFO', 'Webhook server starting...');
log('INFO', `Port: ${PORT}`);
log('INFO', `Project Directory: ${PROJECT_DIR}`);
log('INFO', `Log File: ${LOGFILE}`);

if (!WEBHOOK_SECRET) {
  log('WARN', 'WEBHOOK_SECRET environment variable is not set. Webhook validation will be skipped.');
}

/**
 * Validate webhook signature (Gitea)
 * Gitea sends: X-Gitea-Signature: <hex> (raw, no prefix)
 */
function verifyWebhookSignature(payload, req) {
  if (!WEBHOOK_SECRET) {
    log('WARN', 'Webhook secret not configured, skipping signature validation');
    return { valid: true, source: 'unknown' };
  }

  const hash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Try Gitea signature (raw hex, no prefix)
  const giteaSig = req.headers['x-gitea-signature'];
  if (giteaSig) {
    try {
      const valid = crypto.timingSafeEqual(Buffer.from(giteaSig), Buffer.from(hash));
      return { valid, source: 'gitea' };
    } catch {
      return { valid: false, source: 'gitea' };
    }
  }

  log('WARN', 'No recognized signature header found (X-Gitea-Signature)');
  return { valid: false, source: 'unknown' };
}

/**
 * Execute shell command
 */
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    const childProcess = exec(command, { cwd: PROJECT_DIR }, (error, stdout, stderr) => {
      if (error) {
        log('ERROR', `Command failed: ${command}`);
        log('ERROR', stderr);
        reject(error);
      } else {
        log('INFO', stdout);
        resolve(stdout);
      }
    });

    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data) => {
        log('INFO', data.toString().trim());
      });
    }
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        log('ERROR', data.toString().trim());
      });
    }
  });
}

/**
 * Handle deployment — only triggers on 'main' branch
 */
async function handleDeployment(branch) {
  log('INFO', `Handling deployment for branch: ${branch}`);

  if (branch !== 'main') {
    log('INFO', `Push is to '${branch}' branch, skipping deployment. Only 'main' branch triggers deployment.`);
    return {
      status: 'skipped',
      message: `Skipped: push to ${branch} branch. Only 'main' branch triggers deployment.`,
    };
  }

  try {
    log('INFO', 'Starting deployment...');
    const script = path.join(PROJECT_DIR, 'scripts', 'update-and-restart.sh');
    await executeCommand(`bash ${script}`);
    log('INFO', 'Deployment completed successfully');
    return {
      status: 'success',
      message: 'Deployment completed successfully',
    };
  } catch (error) {
    log('ERROR', `Deployment failed: ${error.message}`);
    return {
      status: 'error',
      message: `Deployment failed: ${error.message}`,
    };
  }
}

/**
 * HTTP request handler
 */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gitea-Signature');
  res.setHeader('Content-Type', 'application/json');

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    log('INFO', 'Health check received');
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      port: PORT,
    }));
    return;
  }

  // Root info
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      message: 'Git Webhook Server (Gitea) — Onboarding',
      endpoints: { health: 'GET /health', webhook: 'POST /webhook' },
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Webhook handler
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';

    req.on('data', (chunk) => { body += chunk; });

    req.on('end', async () => {
      try {
        const { valid, source } = verifyWebhookSignature(body, req);
        if (WEBHOOK_SECRET && !valid) {
          log('ERROR', `Invalid webhook signature (source: ${source})`);
          res.writeHead(401);
          res.end(JSON.stringify({ status: 'error', message: 'Invalid signature' }));
          return;
        }

        const payload = JSON.parse(body);
        const event = req.headers['x-gitea-event'] || 'unknown';
        log('INFO', `Webhook received from ${payload.repository?.name || 'unknown'} (source: ${source})`);
        log('INFO', `Event: ${event}`);

        const ref = payload.ref || '';
        const branch = ref.replace('refs/heads/', '');
        log('INFO', `Branch: ${branch}`);
        log('INFO', `Commits: ${payload.commits?.length || 0}`);

        if (payload.commits && payload.commits.length > 0) {
          payload.commits.forEach((commit) => {
            log('INFO', `  - ${commit.message.split('\n')[0]} (${commit.id.substring(0, 7)})`);
          });
        }

        // Respond immediately, deploy async
        res.writeHead(202);
        res.end(JSON.stringify({
          status: 'accepted',
          message: 'Deployment queued',
          timestamp: new Date().toISOString(),
        }));

        handleDeployment(branch).catch((error) => {
          log('ERROR', `Async deployment error: ${error.message}`);
        });
      } catch (error) {
        log('ERROR', `Error processing webhook: ${error.message}`);
        res.writeHead(400);
        res.end(JSON.stringify({ status: 'error', message: error.message }));
      }
    });

    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ status: 'not_found', message: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  log('INFO', `Webhook server listening on port ${PORT}`);
  log('INFO', 'Waiting for webhooks from Gitea...');
  log('INFO', `Health check: http://YOUR_SERVER_IP:${PORT}/health`);
  log('INFO', `Webhook endpoint: http://YOUR_SERVER_IP:${PORT}/webhook`);
});

server.on('error', (error) => {
  log('ERROR', `Server error: ${error.message}`);
  if (error.code === 'EADDRINUSE') {
    log('ERROR', `Port ${PORT} is already in use`);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  log('INFO', 'Webhook server shutting down...');
  server.close(() => { log('INFO', 'Webhook server stopped'); process.exit(0); });
});

process.on('SIGTERM', () => {
  log('INFO', 'Webhook server terminating...');
  server.close(() => { log('INFO', 'Webhook server terminated'); process.exit(0); });
});
