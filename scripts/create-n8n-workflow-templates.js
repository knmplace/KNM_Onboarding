#!/usr/bin/env node

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

// These IDs are only needed if you want to clone from an existing live workflow.
// Leave blank to create templates from scratch (recommended for fresh installs).
const LIVE_SYNC_WORKFLOW_ID =
  process.env.N8N_LIVE_SYNC_WORKFLOW_ID ||
  process.env.N8N_WEBHOOK_ONBOARDING ||
  null;
const LIVE_REMINDER_WORKFLOW_ID =
  process.env.N8N_LIVE_REMINDER_WORKFLOW_ID || null;
const TEMPLATE_SYNC_NAME =
  process.env.N8N_TEMPLATE_SYNC_WORKFLOW_NAME ||
  "TEMPLATE - User Onboarding Pipeline";
const TEMPLATE_REMINDER_NAME =
  process.env.N8N_TEMPLATE_REMINDER_WORKFLOW_NAME ||
  "TEMPLATE - User Onboarding Reminder & Enforcement";

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function n8nRequest(method, path, body) {
  const baseUrl = clean(process.env.N8N_URL)?.replace(/\/$/, "");
  const apiKey = clean(process.env.N8N_API_KEY);
  if (!baseUrl || !apiKey) {
    throw new Error("N8N_URL or N8N_API_KEY is missing.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
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

function buildTemplatePayload(sourceWorkflow, templateName, sourceId) {
  return {
    name: templateName,
    nodes: structuredClone(sourceWorkflow.nodes || []),
    connections: structuredClone(sourceWorkflow.connections || {}),
    settings: structuredClone(sourceWorkflow.settings || {}),
  };
}

async function saveWorkflow(existingWorkflow, payload) {
  if (!existingWorkflow) {
    return n8nRequest("POST", "/api/v1/workflows", payload);
  }

  return n8nRequest("PUT", `/api/v1/workflows/${existingWorkflow.id}`, payload);
}

async function main() {
  const workflows = await listAllWorkflows();
  const sourceSync = await n8nRequest(
    "GET",
    `/api/v1/workflows/${LIVE_SYNC_WORKFLOW_ID}`
  );
  const sourceReminder = await n8nRequest(
    "GET",
    `/api/v1/workflows/${LIVE_REMINDER_WORKFLOW_ID}`
  );

  const existingTemplateSync =
    workflows.find((workflow) => workflow.name === TEMPLATE_SYNC_NAME) || null;
  const existingTemplateReminder =
    workflows.find((workflow) => workflow.name === TEMPLATE_REMINDER_NAME) || null;

  const savedSync = await saveWorkflow(
    existingTemplateSync,
    buildTemplatePayload(sourceSync, TEMPLATE_SYNC_NAME, LIVE_SYNC_WORKFLOW_ID)
  );
  const savedReminder = await saveWorkflow(
    existingTemplateReminder,
    buildTemplatePayload(
      sourceReminder,
      TEMPLATE_REMINDER_NAME,
      LIVE_REMINDER_WORKFLOW_ID
    )
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        templates: {
          sync: {
            id: savedSync.id,
            name: savedSync.name,
            action: existingTemplateSync ? "updated" : "created",
            active: false,
            sourceWorkflowId: LIVE_SYNC_WORKFLOW_ID,
          },
          reminder: {
            id: savedReminder.id,
            name: savedReminder.name,
            action: existingTemplateReminder ? "updated" : "created",
            active: false,
            sourceWorkflowId: LIVE_REMINDER_WORKFLOW_ID,
          },
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
