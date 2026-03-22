import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWpConfigForSite } from "@/lib/site-config";
import { PLUGIN_PHP, PLUGIN_FILENAME, PLUGIN_SLUG } from "@/lib/plugin-source";
import { buildZip } from "@/lib/plugin-source";

function parseSiteId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * POST /api/sites/[id]/install-plugin
 *
 * 1. Builds the plugin ZIP in-process
 * 2. Uploads it to WordPress via POST /wp-json/wp/v2/plugins (requires admin creds)
 * 3. Activates it via PUT /wp-json/wp/v2/plugins/<slug> { status: "active" }
 *
 * Requires the WordPress user stored in the site record to have Administrator role.
 * If the user is not an admin the upload step will return 403 and we surface that clearly.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const siteId = parseSiteId(id);
  if (!siteId) {
    return NextResponse.json({ error: "Invalid site id." }, { status: 400 });
  }

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  const wpConfig = getWpConfigForSite(site);
  const baseUrl = site.wordpressUrl ?? wpConfig.wordpressRestApiUrl.replace(/\/wp-json\/wp\/v2$/, "");
  const restBase = `${baseUrl}/wp-json/wp/v2`;

  const authHeader = "Basic " + Buffer.from(
    `${wpConfig.username}:${wpConfig.applicationPassword}`
  ).toString("base64");

  // ── Step 1: Build ZIP ──────────────────────────────────────────────────────
  const zipBytes = buildZip(PLUGIN_SLUG, PLUGIN_FILENAME, PLUGIN_PHP);

  // ── Step 2: Upload plugin ZIP ──────────────────────────────────────────────
  const formData = new FormData();
  formData.append(
    "pluginzip",
    new Blob([new Uint8Array(zipBytes)], { type: "application/zip" }),
    `${PLUGIN_SLUG}.zip`
  );

  let uploadRes: Response;
  try {
    uploadRes = await fetch(`${restBase}/plugins`, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: formData,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach WordPress: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  if (!uploadRes.ok) {
    let detail = "";
    try { detail = await uploadRes.text(); } catch { /* ignore */ }
    if (uploadRes.status === 403) {
      return NextResponse.json(
        { error: "WordPress returned 403. The configured user does not have Administrator role. Grant admin privileges to this user in WordPress, then try again." },
        { status: 403 }
      );
    }
    if (uploadRes.status === 409) {
      // Plugin already exists — skip to activation
    } else {
      return NextResponse.json(
        { error: `Plugin upload failed (${uploadRes.status}): ${detail}` },
        { status: 502 }
      );
    }
  }

  // ── Step 3: Activate plugin ────────────────────────────────────────────────
  // WP REST uses the plugin slug as the identifier: folder/filename without .php
  const pluginId = `${PLUGIN_SLUG}/${PLUGIN_SLUG}`;

  let activateRes: Response;
  try {
    activateRes = await fetch(`${restBase}/plugins/${pluginId}`, {
      method: "PUT",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "active" }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Upload succeeded but activation request failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  if (!activateRes.ok) {
    let detail = "";
    try { detail = await activateRes.text(); } catch { /* ignore */ }
    return NextResponse.json(
      { error: `Plugin uploaded but activation failed (${activateRes.status}): ${detail}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "KNM Onboarding Helper installed and activated successfully.",
  });
}
