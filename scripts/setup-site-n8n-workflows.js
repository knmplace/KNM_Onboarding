#!/usr/bin/env node

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { Client } = require("pg");
const {
  provisionSiteWorkflows,
} = require("./lib/site-n8n-provision");

function parseArgs(argv) {
  const args = {
    siteId: null,
    siteSlug: null,
    activate: true,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (/^\d+$/.test(value) && !args.siteId && !args.siteSlug) {
      args.siteId = Number.parseInt(value, 10);
      continue;
    }
    if (value === "--activate") {
      args.activate = true;
      continue;
    }
    if (value === "--inactive" || value === "--deactivate") {
      args.activate = false;
      continue;
    }
    if (value.startsWith("--site-id=")) {
      args.siteId = Number.parseInt(value.split("=")[1], 10);
      continue;
    }
    if (value === "--site-id") {
      args.siteId = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }
    if (value.startsWith("--site-slug=")) {
      args.siteSlug = value.split("=")[1];
      continue;
    }
    if (value === "--site-slug") {
      args.siteSlug = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadSite(client, { siteId, siteSlug }) {
  if (Number.isInteger(siteId)) {
    const result = await client.query(
      `
        SELECT id, slug, name, smtp_from_email, n8n_webhook_auth_key,
               n8n_sync_workflow_id, n8n_reminder_workflow_id
        FROM site
        WHERE id = $1
        LIMIT 1
      `,
      [siteId]
    );
    return result.rows[0] || null;
  }

  if (clean(siteSlug)) {
    const result = await client.query(
      `
        SELECT id, slug, name, smtp_from_email, n8n_webhook_auth_key,
               n8n_sync_workflow_id, n8n_reminder_workflow_id
        FROM site
        WHERE slug = $1
        LIMIT 1
      `,
      [siteSlug.trim()]
    );
    return result.rows[0] || null;
  }

  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.siteId && !args.siteSlug) {
    throw new Error("Pass --site-id <id> or --site-slug <slug>.");
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const site = await loadSite(client, args);
    if (!site) {
      throw new Error("Site not found.");
    }

    const provisioning = await provisionSiteWorkflows(site, {
      activate: args.activate,
    });

    await client.query(
      `
        UPDATE site
        SET n8n_sync_workflow_id = $2,
            n8n_reminder_workflow_id = $3,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        site.id,
        provisioning.workflows.sync.id,
        provisioning.workflows.reminder.id,
      ]
    );

    console.log(
      JSON.stringify(
        {
          ok: provisioning.ok,
          site: {
            id: site.id,
            slug: site.slug,
            name: site.name,
          },
          ...provisioning,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
