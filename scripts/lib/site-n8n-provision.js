require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

// These IDs are populated automatically after running: npm run n8n:create-templates
const SOURCE_SYNC_WORKFLOW_ID =
  process.env.N8N_TEMPLATE_SYNC_WORKFLOW_ID || null;
const SOURCE_REMINDER_WORKFLOW_ID =
  process.env.N8N_TEMPLATE_REMINDER_WORKFLOW_ID || null;
const INTERNAL_ONBOARDING_API_BASE =
  process.env.INTERNAL_ONBOARDING_API_BASE || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:6000";

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

async function getWorkflowById(workflowId) {
  const id = clean(workflowId);
  if (!id) return null;

  try {
    return await n8nRequest("GET", `/api/v1/workflows/${id}`);
  } catch {
    return null;
  }
}

function cloneWorkflowPayload(workflow, name, nodes) {
  return {
    name,
    nodes,
    connections: workflow.connections || {},
    settings: workflow.settings || {},
  };
}

function updateHttpHeader(parameters, name, value) {
  if (!parameters.headerParameters?.parameters) return;
  const match = parameters.headerParameters.parameters.find(
    (header) => header.name === name
  );
  if (match) {
    match.value = value;
  }
}

function setQueryParam(parameters, name, value) {
  if (!parameters.queryParameters) {
    parameters.queryParameters = { parameters: [] };
  }
  if (!Array.isArray(parameters.queryParameters.parameters)) {
    parameters.queryParameters.parameters = [];
  }
  const existing = parameters.queryParameters.parameters.find(
    (item) => item.name === name
  );
  if (existing) {
    existing.value = String(value);
    return;
  }
  parameters.queryParameters.parameters.push({ name, value: String(value) });
}

function replaceHtmlBranding(html, siteName, appUrl) {
  return html
    .replaceAll("My Site", siteName)
    .replaceAll("http://localhost:6000", appUrl)
    .replaceAll("http://localhost:3000", appUrl);
}

function transformSyncWorkflow(workflow, site, authKey, appUrl) {
  const clonedNodes = structuredClone(workflow.nodes || []).map((node) => {
    const nextNode = structuredClone(node);

    if (nextNode.name === "Call Sync API") {
      nextNode.parameters.url = `${appUrl}/api/onboarding/sync`;
      nextNode.parameters.sendHeaders = true;
      updateHttpHeader(nextNode.parameters, "X-Onboarding-Key", authKey);
      updateHttpHeader(nextNode.parameters, "Content-Type", "application/json");
      nextNode.parameters.sendBody = true;
      nextNode.parameters.contentType = "json";
      nextNode.parameters.specifyBody = "json";
      nextNode.parameters.jsonBody = JSON.stringify({ siteId: site.id });
    }

    if (nextNode.name === "Get Pending Users") {
      nextNode.parameters.url = `${appUrl}/api/users`;
      nextNode.parameters.sendHeaders = true;
      updateHttpHeader(nextNode.parameters, "X-Onboarding-Key", authKey);
      setQueryParam(nextNode.parameters, "step", "pending_approval");
      setQueryParam(nextNode.parameters, "siteId", site.id);
    }

    if (nextNode.name === "Email Admin Notification") {
      nextNode.parameters.fromEmail =
        clean(site.smtp_from_email) ||
        clean(process.env.SMTP_FROM_EMAIL) ||
        nextNode.parameters.fromEmail;
      nextNode.parameters.subject = `=${site.name} Pending Approval Users - Sync Summary`;
      if (typeof nextNode.parameters.html === "string") {
        nextNode.parameters.html = replaceHtmlBranding(
          nextNode.parameters.html,
          site.name,
          appUrl
        );
      }
    }

    return nextNode;
  });

  return cloneWorkflowPayload(
    workflow,
    `${site.name} - User Onboarding Pipeline`,
    clonedNodes
  );
}

function transformReminderWorkflow(workflow, site, authKey, appUrl) {
  const clonedNodes = structuredClone(workflow.nodes || []).map((node) => {
    const nextNode = structuredClone(node);

    if (nextNode.name === "Run Reminders API") {
      nextNode.parameters.url = `${appUrl}/api/onboarding/reminders/run`;
      nextNode.parameters.sendHeaders = true;
      updateHttpHeader(nextNode.parameters, "X-Onboarding-Key", authKey);
      updateHttpHeader(nextNode.parameters, "Content-Type", "application/json");
      nextNode.parameters.sendBody = true;
      nextNode.parameters.contentType = "json";
      nextNode.parameters.specifyBody = "json";
      nextNode.parameters.jsonBody = JSON.stringify({ siteId: site.id });
    }

    return nextNode;
  });

  return cloneWorkflowPayload(
    workflow,
    `${site.name} - User Onboarding Reminder & Enforcement`,
    clonedNodes
  );
}

async function saveWorkflow(existingWorkflow, payload) {
  if (!existingWorkflow) {
    return n8nRequest("POST", "/api/v1/workflows", payload);
  }

  return n8nRequest("PUT", `/api/v1/workflows/${existingWorkflow.id}`, payload);
}

async function setWorkflowActive(workflowId, active) {
  const payload = { active };
  return n8nRequest(
    "POST",
    `/api/v1/workflows/${workflowId}/${active ? "activate" : "deactivate"}`,
    payload
  ).catch(async () => {
    return n8nRequest("PATCH", `/api/v1/workflows/${workflowId}`, payload);
  });
}

async function verifyProvisionedSite(site, authKey, appUrl) {
  const checks = [];
  const targets = [
    {
      name: "users",
      url: `${appUrl}/api/users?siteId=${site.id}`,
      method: "GET",
    },
    {
      name: "reminderPreview",
      url: `${appUrl}/api/onboarding/reminders/preview?siteId=${site.id}`,
      method: "GET",
    },
  ];

  for (const target of targets) {
    const response = await fetch(target.url, {
      method: target.method,
      headers: {
        "X-Onboarding-Key": authKey,
      },
    });
    const text = await response.text();
    checks.push({
      name: target.name,
      ok: response.ok,
      status: response.status,
      detail: text.slice(0, 300),
    });
  }

  return checks;
}

async function provisionSiteWorkflows(site, options = {}) {
  const appUrl =
    clean(options.appUrl) || INTERNAL_ONBOARDING_API_BASE.replace(/\/$/, "");
  const authKey = clean(site.n8n_webhook_auth_key || site.n8nWebhookAuthKey);
  if (!authKey) {
    throw new Error(`Site ${site.slug} is missing n8n_webhook_auth_key.`);
  }

  const workflows = await listAllWorkflows();

  if (!SOURCE_SYNC_WORKFLOW_ID || !SOURCE_REMINDER_WORKFLOW_ID) {
    throw new Error(
      "N8N_TEMPLATE_SYNC_WORKFLOW_ID or N8N_TEMPLATE_REMINDER_WORKFLOW_ID is not set in .env.local.\n" +
        "Run: npm run n8n:create-templates"
    );
  }

  const sourceSync = await n8nRequest(
    "GET",
    `/api/v1/workflows/${SOURCE_SYNC_WORKFLOW_ID}`
  );
  const sourceReminder = await n8nRequest(
    "GET",
    `/api/v1/workflows/${SOURCE_REMINDER_WORKFLOW_ID}`
  );

  const syncName = `${site.name} - User Onboarding Pipeline`;
  const reminderName = `${site.name} - User Onboarding Reminder & Enforcement`;
  const existingSync =
    (await getWorkflowById(site.n8n_sync_workflow_id || site.n8nSyncWorkflowId)) ||
    workflows.find((workflow) => workflow.name === syncName) ||
    null;
  const existingReminder =
    (await getWorkflowById(
      site.n8n_reminder_workflow_id || site.n8nReminderWorkflowId
    )) ||
    workflows.find((workflow) => workflow.name === reminderName) ||
    null;

  const syncPayload = transformSyncWorkflow(sourceSync, site, authKey, appUrl);
  const reminderPayload = transformReminderWorkflow(
    sourceReminder,
    site,
    authKey,
    appUrl
  );

  const savedSync = await saveWorkflow(existingSync, syncPayload);
  const savedReminder = await saveWorkflow(existingReminder, reminderPayload);

  const activate =
    options.activate === undefined ? true : Boolean(options.activate);
  if (activate) {
    await setWorkflowActive(savedSync.id, true);
    await setWorkflowActive(savedReminder.id, true);
  }

  const verification = await verifyProvisionedSite(site, authKey, appUrl);

  return {
    ok: verification.every((check) => check.ok),
    authMode: "per_site_machine_key",
    appUrl,
    sourceWorkflows: {
      syncTemplateId: SOURCE_SYNC_WORKFLOW_ID,
      reminderTemplateId: SOURCE_REMINDER_WORKFLOW_ID,
    },
    workflows: {
      sync: {
        id: savedSync.id,
        name: savedSync.name,
        action: existingSync ? "updated" : "created",
        active: activate,
      },
      reminder: {
        id: savedReminder.id,
        name: savedReminder.name,
        action: existingReminder ? "updated" : "created",
        active: activate,
      },
    },
    verification,
  };
}

module.exports = {
  INTERNAL_ONBOARDING_API_BASE,
  verifyProvisionedSite,
  provisionSiteWorkflows,
};
