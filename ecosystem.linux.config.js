/**
 * Homestead — PM2 Ecosystem Config (Linux Production)
 *
 * Generated and customized by deploy.sh.
 * To use manually: pm2 start ecosystem.linux.config.js
 *
 * Environment variables (set in .env.local or system env):
 *   PM2_APP_NAME  — PM2 process name          (default: homestead)
 *   PROJECT_DIR   — Absolute install path      (default: /opt/homestead)
 *   APP_PORT      — Port the Next.js app runs on (default: 6001)
 */

const appName = process.env.PM2_APP_NAME || "homestead";
const projectDir = process.env.PROJECT_DIR || "/opt/homestead";
const appPort = parseInt(process.env.APP_PORT || "6001", 10);

module.exports = {
  apps: [
    {
      name: appName,
      script: `${projectDir}/start.mjs`,
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
