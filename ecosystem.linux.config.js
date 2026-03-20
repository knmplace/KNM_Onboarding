/**
 * ADOB — PM2 Ecosystem Config (Linux Production)
 *
 * Generated and customized by deploy.sh.
 * To use manually: pm2 start ecosystem.linux.config.js
 *
 * Environment variables (set in .env.local or system env):
 *   PM2_APP_NAME  — PM2 process name          (default: adob)
 *   PROJECT_DIR   — Absolute install path      (default: /opt/adob)
 *   APP_PORT      — Port the Next.js app runs on (default: 6001)
 */

const appName = process.env.PM2_APP_NAME || "adob";
const projectDir = process.env.PROJECT_DIR || "/opt/adob";
const appPort = parseInt(process.env.APP_PORT || "6001", 10);

module.exports = {
  apps: [
    {
      name: appName,
      script: "npm",
      args: "start",
      cwd: projectDir,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: appPort,
      },
      error_file: `${projectDir}/logs/error.log`,
      out_file: `${projectDir}/logs/out.log`,
      log_file: `${projectDir}/logs/combined.log`,
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
    },
  ],
};
