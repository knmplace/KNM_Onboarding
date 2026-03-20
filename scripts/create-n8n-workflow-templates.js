#!/usr/bin/env node
/**
 * create-n8n-workflow-templates.js
 *
 * Imports the bundled workflow template JSON files into n8n and writes the
 * resulting workflow IDs back to .env.local so site provisioning can find them.
 *
 * Usage:
 *   node scripts/create-n8n-workflow-templates.js
 *   npm run n8n:create-templates
 *
 * Idempotent — if a workflow with the same name already exists it is updated,
 * not duplicated.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const fs = require("fs");
const path = require("path");

const TEMPLATES_DIR = path.join(__dirname, "n8n-templates");
const SYNC_FILE = path.join(TEMPLATES_DIR, "TEMPLATE - User Onboarding Pipeline.json");
const REMINDER_FILE = path.join(
  TEMPLATES_DIR,
  "TEMPLATE - User Onboarding Reminder & Enforcement.json"
);

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function n8nRequest(method, endpoint, body) {
  const baseUrl = clean(process.env.N8N_URL)?.replace(/\/$/, "");
  const apiKey = clean(process.env.N8N_API_KEY);
  if (!baseUrl || !apiKey) {
    throw new Error("N8N_URL or N8N_API_KEY is missing from .env.local.");
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${endpoint} failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function listAllWorkflows() {
  const workflows = [];
  let cursor = null;
  do {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "?limit=250";
    const page = await n8nRequest("GET", `/api/v1/workflows${query}`);
    workflows.push(...(page.data || []));
    cursor = page.nextCursor || null;
  } while (cursor);
  return workflows;
}

async function importTemplate(templateFile, existingWorkflows) {
  if (!fs.existsSync(templateFile)) {
    throw new Error(`Template file not found: ${templateFile}`);
  }

  const template = JSON.parse(fs.readFileSync(templateFile, "utf-8"));

  // Strip the source instance's ID — n8n will assign a new one on POST
  const { id: _id, ...payload } = template;

  const existing = existingWorkflows.find((w) => w.name === template.name) || null;

  if (existing) {
    const updated = await n8nRequest("PUT", `/api/v1/workflows/${existing.id}`, payload);
    return { workflow: updated, action: "updated" };
  } else {
    const created = await n8nRequest("POST", "/api/v1/workflows", payload);
    return { workflow: created, action: "created" };
  }
}

function writeIdsToEnv(syncId, reminderId) {
  const envPath = path.resolve(process.cwd(), ".env.local");
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  for (const [key, val] of [
    ["N8N_TEMPLATE_SYNC_WORKFLOW_ID", String(syncId)],
    ["N8N_TEMPLATE_REMINDER_WORKFLOW_ID", String(reminderId)],
  ]) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}="${val}"`;
    if (pattern.test(content)) {
      content = content.replace(pattern, line);
    } else {
      content += `\n${line}`;
    }
  }

  fs.writeFileSync(envPath, content, { mode: 0o600 });
}

async function main() {
  const existing = await listAllWorkflows();

  const { workflow: syncWorkflow, action: syncAction } = await importTemplate(
    SYNC_FILE,
    existing
  );
  const { workflow: reminderWorkflow, action: reminderAction } = await importTemplate(
    REMINDER_FILE,
    existing
  );

  // Write IDs back to .env.local so site provisioning can find them
  writeIdsToEnv(syncWorkflow.id, reminderWorkflow.id);

  console.log(
    JSON.stringify(
      {
        ok: true,
        templates: {
          sync: {
            id: syncWorkflow.id,
            name: syncWorkflow.name,
            action: syncAction,
          },
          reminder: {
            id: reminderWorkflow.id,
            name: reminderWorkflow.name,
            action: reminderAction,
          },
        },
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
