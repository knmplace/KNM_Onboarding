/**
 * ADOB production startup — loads .env.local before starting Next.js.
 *
 * Next.js 16 does NOT load .env.local at runtime in production mode when
 * started via `npm start` or `next start` directly. This wrapper ensures
 * all environment variables from .env.local are present in process.env
 * before the Next.js server initialises.
 *
 * Usage (via ecosystem.linux.config.js): pm2 start ecosystem.linux.config.js
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local into process.env
const envFile = path.join(__dirname, ".env.local");
if (fs.existsSync(envFile)) {
  const dotenv = require("dotenv");
  const result = dotenv.config({ path: envFile, override: false });
  if (result.error) {
    console.error("[start.mjs] Failed to load .env.local:", result.error.message);
  } else {
    const count = Object.keys(result.parsed || {}).length;
    console.log(`[start.mjs] Loaded ${count} vars from .env.local`);
  }
} else {
  console.warn("[start.mjs] .env.local not found — running without it");
}

// Determine port
const port = process.env.PORT || process.env.APP_PORT || "6001";

// Start Next.js
const nextBin = path.join(__dirname, "node_modules", ".bin", "next");
const child = spawn(process.execPath, [nextBin, "start", "-p", port], {
  stdio: "inherit",
  env: process.env,
  cwd: __dirname,
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("[start.mjs] Failed to start Next.js:", err.message);
  process.exit(1);
});
