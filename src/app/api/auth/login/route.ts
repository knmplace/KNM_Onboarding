import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcrypt";
import { createSession, setSessionCookie } from "@/lib/auth";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    // ── Local admin authentication ────────────────────────────────────────────
    const admin = await prisma.adminUser.findUnique({ where: { email } });

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const valid = await compare(password, admin.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await createSession({
      adminId: admin.id.toString(),
      email: admin.email,
      displayName: `${admin.firstName} ${admin.lastName}`.trim(),
      role: admin.role as "OWNER" | "ADMIN",
      isAdmin: true,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        adminId: admin.id.toString(),
        email: admin.email,
        displayName: `${admin.firstName} ${admin.lastName}`.trim(),
        role: admin.role,
        isAdmin: true,
      },
    });

  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── WordPress login (kept for future use, currently not active) ───────────────
//
// To re-enable WordPress-based admin login, uncomment the block below and
// replace the local auth block above with a call to wpLogin().
//
// interface WpMeResponse {
//   id: number;
//   email: string;
//   name: string;
//   roles: string[];
// }
//
// async function wpLogin(username: string, password: string) {
//   const wpRestUrl = process.env.WORDPRESS_REST_API_URL;
//   if (!wpRestUrl) throw new Error("WORDPRESS_REST_API_URL not configured");
//
//   const credentials = Buffer.from(`${username}:${password}`).toString("base64");
//   const response = await fetch(`${wpRestUrl}/users/me?context=edit`, {
//     headers: { Authorization: `Basic ${credentials}` },
//   });
//
//   if (response.status === 401 || response.status === 403) {
//     const err = await response.json().catch(() => ({})) as { message?: string };
//     throw Object.assign(new Error(err.message || "Invalid credentials"), { status: 401 });
//   }
//   if (!response.ok) throw Object.assign(new Error(`WordPress auth failed (${response.status})`), { status: 502 });
//
//   const user = await response.json() as WpMeResponse;
//   if (!Array.isArray(user.roles) || !user.roles.includes("administrator")) {
//     throw Object.assign(new Error("Admin access required"), { status: 403 });
//   }
//   return user;
// }
