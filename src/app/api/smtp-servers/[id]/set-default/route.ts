import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const serverId = Number(id);
    if (!serverId) return NextResponse.json({ error: "Invalid ID." }, { status: 400 });

    const server = await prisma.smtpServer.findUnique({ where: { id: serverId } });
    if (!server) return NextResponse.json({ error: "Server not found." }, { status: 404 });

    // Clear existing default, then set new one — in a transaction
    await prisma.$transaction([
      prisma.smtpServer.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      prisma.smtpServer.update({ where: { id: serverId }, data: { isDefault: true } }),
    ]);

    return NextResponse.json({ ok: true, defaultId: serverId });
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

    await prisma.smtpServer.update({ where: { id: serverId }, data: { isDefault: false } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
