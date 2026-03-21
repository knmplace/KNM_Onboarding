import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const servers = await prisma.smtpServer.findMany({
      orderBy: { label: "asc" },
      select: {
        id: true,
        label: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        fromEmail: true,
        fromName: true,
        createdAt: true,
        updatedAt: true,
        // password intentionally omitted
        sites: { select: { id: true, name: true, slug: true } },
      },
    });
    return NextResponse.json({ servers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { label, host, port, secure, username, password, fromEmail, fromName } = body;

    if (!label?.trim()) return NextResponse.json({ error: "Label is required." }, { status: 400 });
    if (!host?.trim()) return NextResponse.json({ error: "Host is required." }, { status: 400 });
    if (!username?.trim()) return NextResponse.json({ error: "Username is required." }, { status: 400 });
    if (!password?.trim()) return NextResponse.json({ error: "Password is required." }, { status: 400 });
    if (!fromEmail?.trim()) return NextResponse.json({ error: "From email is required." }, { status: 400 });

    const server = await prisma.smtpServer.create({
      data: {
        label: label.trim(),
        host: host.trim(),
        port: Number(port) || 465,
        secure: secure !== false,
        username: username.trim(),
        password: password.trim(),
        fromEmail: fromEmail.trim(),
        fromName: fromName?.trim() || null,
      },
      select: {
        id: true, label: true, host: true, port: true,
        secure: true, username: true, fromEmail: true, fromName: true,
        createdAt: true, updatedAt: true,
        sites: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({ ok: true, server }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
