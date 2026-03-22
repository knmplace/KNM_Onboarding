import { NextResponse } from "next/server";
import { PLUGIN_PHP, PLUGIN_FILENAME, PLUGIN_SLUG, buildZip } from "@/lib/plugin-source";

/**
 * GET /api/wordpress-setup/download
 *   ?format=php  → raw .php file (for mu-plugins manual install)
 *   ?format=zip  → standard WP plugin ZIP (for Admin → Plugins → Upload)
 *   (default)    → zip
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "zip";

  if (format === "php") {
    return new NextResponse(PLUGIN_PHP, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${PLUGIN_FILENAME}"`,
      },
    });
  }

  const zipBytes = buildZip(PLUGIN_SLUG, PLUGIN_FILENAME, PLUGIN_PHP);
  return new NextResponse(new Uint8Array(zipBytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${PLUGIN_SLUG}.zip"`,
    },
  });
}
