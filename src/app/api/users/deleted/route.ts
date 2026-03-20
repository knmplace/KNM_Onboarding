import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDefaultSiteRecord, resolveSiteSelection } from "@/lib/site-config";

/**
 * GET /api/users/deleted - List all archived (deleted from WP) users
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const site =
      (await resolveSiteSelection({
        siteId: searchParams.get("siteId")
          ? Number.parseInt(searchParams.get("siteId") || "", 10)
          : null,
        siteSlug: searchParams.get("siteSlug"),
      })) || (await getDefaultSiteRecord());

    const where = {
      deletedFromWp: true,
      ...(site ? { siteId: site.id } : {}),
    };

    const users = await prisma.onboardingState.findMany({
      where,
      orderBy: { deletedAt: "desc" },
    });

    return NextResponse.json({
      users,
      count: users.length,
      site: site
        ? { id: site.id, slug: site.slug, name: site.name }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/users/deleted - Permanently delete archived users
 * Body: { ids: number[] }
 */
export async function DELETE(request: Request) {
  try {
    const { ids, siteId, siteSlug } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids array is required" },
        { status: 400 }
      );
    }

    const site =
      (await resolveSiteSelection({
        siteId:
          typeof siteId === "number" && Number.isInteger(siteId) ? siteId : null,
        siteSlug: typeof siteSlug === "string" ? siteSlug : null,
      })) || (await getDefaultSiteRecord());

    const result = await prisma.onboardingState.deleteMany({
      where: {
        id: { in: ids },
        deletedFromWp: true, // Safety: only delete already-archived records
        ...(site ? { siteId: site.id } : {}),
      },
    });

    return NextResponse.json({
      deleted: result.count,
      requested: ids.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
