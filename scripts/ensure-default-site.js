#!/usr/bin/env node

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { Client } = require("pg");

function parseOptionalInt(value) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalBool(value) {
  if (value === undefined) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function clean(value) {
  return value && value.trim() ? value.trim() : null;
}

function generateMachineKey() {
  return `site_${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}${Date.now().toString(36)}`;
}

function getSeed() {
  return {
    slug: clean(process.env.DEFAULT_SITE_SLUG) || "my-site",
    name: clean(process.env.DEFAULT_SITE_NAME) || "My Site",
    onboardingAppUrl: clean(process.env.NEXT_PUBLIC_APP_URL),
    accountLoginUrl:
      clean(process.env.ACCOUNT_LOGIN_URL) || "https://your-site.com/login",
    wordpressUrl: clean(process.env.WORDPRESS_URL),
    wordpressRestApiUrl: clean(process.env.WORDPRESS_REST_API_URL),
    wordpressUsername: clean(process.env.WORDPRESS_USERNAME),
    wordpressAppPassword: clean(process.env.WORDPRESS_APP_PASSWORD),
    profilegridApiUrl: clean(process.env.PROFILEGRID_API_URL),
    profilegridUsername:
      clean(process.env.PROFILEGRID_USERNAME) ||
      clean(process.env.WORDPRESS_USERNAME),
    profilegridAppPassword:
      clean(process.env.PROFILEGRID_APP_PASSWORD) ||
      clean(process.env.WORDPRESS_APP_PASSWORD),
    smtpHost: clean(process.env.SMTP_HOST),
    smtpPort: parseOptionalInt(process.env.SMTP_PORT),
    smtpSecure: parseOptionalBool(process.env.SMTP_SECURE),
    smtpUsername: clean(process.env.SMTP_USERNAME),
    smtpPassword: clean(process.env.SMTP_PASSWORD),
    smtpFromEmail: clean(process.env.SMTP_FROM_EMAIL),
    smtpFromName: clean(process.env.SMTP_FROM_NAME),
    supportEmail: clean(process.env.SUPPORT_EMAIL),
    emailFooterImageUrl: clean(process.env.EMAIL_FOOTER_IMAGE_URL),
    n8nWebhookAuthKey: clean(process.env.N8N_WEBHOOK_AUTH_KEY) || generateMachineKey(),
    n8nSyncWorkflowId: null,
    n8nReminderWorkflowId: null,
    breachResearchUrl:
      clean(process.env.BREACH_RESEARCH_URL) || "https://haveibeenpwned.com",
  };
}

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS site (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      onboarding_app_url TEXT,
      account_login_url TEXT,
      wordpress_url TEXT,
      wordpress_rest_api_url TEXT,
      wordpress_username TEXT,
      wordpress_app_password TEXT,
      profilegrid_api_url TEXT,
      profilegrid_username TEXT,
      profilegrid_app_password TEXT,
      smtp_host TEXT,
      smtp_port INTEGER,
      smtp_secure BOOLEAN,
      smtp_username TEXT,
      smtp_password TEXT,
      smtp_from_email TEXT,
      smtp_from_name TEXT,
      support_email TEXT,
      email_footer_image_url TEXT,
      n8n_webhook_auth_key TEXT,
      n8n_sync_workflow_id TEXT,
      n8n_reminder_workflow_id TEXT,
      breach_research_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    ALTER TABLE onboarding_state
    ADD COLUMN IF NOT EXISTS site_id INTEGER
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'onboarding_state'
          AND constraint_name = 'onboarding_state_site_id_fkey'
      ) THEN
        ALTER TABLE onboarding_state
        ADD CONSTRAINT onboarding_state_site_id_fkey
        FOREIGN KEY (site_id) REFERENCES site(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);
}

async function upsertDefaultSite(client, seed) {
  const existing = await client.query(
    `
      SELECT id, slug, name
      FROM site
      WHERE slug = $1 OR name = $2
      ORDER BY id ASC
      LIMIT 1
    `,
    [seed.slug, seed.name]
  );

  const values = [
    seed.slug,
    seed.name,
    true,
    seed.onboardingAppUrl,
    seed.accountLoginUrl,
    seed.wordpressUrl,
    seed.wordpressRestApiUrl,
    seed.wordpressUsername,
    seed.wordpressAppPassword,
    seed.profilegridApiUrl,
    seed.profilegridUsername,
    seed.profilegridAppPassword,
    seed.smtpHost,
    seed.smtpPort,
    seed.smtpSecure,
    seed.smtpUsername,
    seed.smtpPassword,
    seed.smtpFromEmail,
    seed.smtpFromName,
    seed.supportEmail,
    seed.emailFooterImageUrl,
    seed.n8nWebhookAuthKey,
    seed.n8nSyncWorkflowId,
    seed.n8nReminderWorkflowId,
    seed.breachResearchUrl,
  ];

  if (existing.rows.length > 0) {
    const updated = await client.query(
      `
        UPDATE site
        SET slug = $1,
            name = $2,
            is_active = $3,
            onboarding_app_url = $4,
            account_login_url = $5,
            wordpress_url = $6,
            wordpress_rest_api_url = $7,
            wordpress_username = $8,
            wordpress_app_password = $9,
            profilegrid_api_url = $10,
            profilegrid_username = $11,
            profilegrid_app_password = $12,
            smtp_host = $13,
            smtp_port = $14,
            smtp_secure = $15,
            smtp_username = $16,
            smtp_password = $17,
            smtp_from_email = $18,
            smtp_from_name = $19,
            support_email = $20,
            email_footer_image_url = $21,
            n8n_webhook_auth_key = $22,
            n8n_sync_workflow_id = $23,
            n8n_reminder_workflow_id = $24,
            breach_research_url = $25,
            updated_at = NOW()
        WHERE id = $26
        RETURNING id, slug, name
      `,
      [...values, existing.rows[0].id]
    );
    return updated.rows[0];
  }

  const inserted = await client.query(
    `
      INSERT INTO site (
        slug,
        name,
        is_active,
        onboarding_app_url,
        account_login_url,
        wordpress_url,
        wordpress_rest_api_url,
        wordpress_username,
        wordpress_app_password,
        profilegrid_api_url,
        profilegrid_username,
        profilegrid_app_password,
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_username,
        smtp_password,
        smtp_from_email,
        smtp_from_name,
        support_email,
        email_footer_image_url,
        n8n_webhook_auth_key,
        n8n_sync_workflow_id,
        n8n_reminder_workflow_id,
        breach_research_url
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      )
      RETURNING id, slug, name
    `,
    values
  );

  return inserted.rows[0];
}

async function finalizeIndexes(client) {
  await client.query(`
    DROP INDEX IF EXISTS onboarding_state_wordpress_id_key
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS onboarding_state_site_wordpress_id_key
    ON onboarding_state (site_id, wordpress_id)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS onboarding_state_site_step_deleted_idx
    ON onboarding_state (site_id, onboarding_step, deleted_from_wp)
  `);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const seed = getSeed();

  try {
    await client.connect();
    await client.query("BEGIN");

    await ensureSchema(client);
    const site = await upsertDefaultSite(client, seed);

    const backfill = await client.query(
      `
        UPDATE onboarding_state
        SET site_id = $1
        WHERE site_id IS NULL
      `,
      [site.id]
    );

    await finalizeIndexes(client);

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          ok: true,
          siteId: site.id,
          slug: site.slug,
          name: site.name,
          backfilledRows: backfill.rowCount,
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
