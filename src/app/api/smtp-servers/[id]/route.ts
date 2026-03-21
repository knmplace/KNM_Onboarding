import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const serverId = Number(id);
    if (!serverId) return NextResponse.json({ error: "Invalid ID." }, { status: 400 });

    const body = await request.json();
    const { label, host, port, secure, username, password, fromEmail, fromName } = body;

    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = label.trim();
    if (host !== undefined) data.host = host.trim();
    if (port !== undefined) data.port = Number(port) || 465;
    if (secure !== undefined) data.secure = secure !== false;
    if (username !== undefined) data.username = username.trim();
    if (password?.trim()) data.password = password.trim();
    if (fromEmail !== undefined) data.fromEmail = fromEmail.trim();
    if (fromName !== undefined) data.fromName = fromName?.trim() || null;

    const server = await prisma.smtpServer.update({
      where: { id: serverId },
      data,
      select: {
        id: true, label: true, host: true, port: true,
        secure: true, username: true, fromEmail: true, fromName: true,
        isDefault: true, createdAt: true, updatedAt: true,
        sites: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({ ok: true, server });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const serverId = Number(id);
    if (!serverId) return NextResponse.json({ error: "Invalid ID." }, { status: 400 });

    // Detach from all sites first (set smtpServerId = null)
    await prisma.site.updateMany({
      where: { smtpServerId: serverId },
      data: { smtpServerId: null },
    });

    await prisma.smtpServer.delete({ where: { id: serverId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
