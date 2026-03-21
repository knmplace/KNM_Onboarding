import { NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth";

interface WpMeResponse {
  id: number;
  email: string;
  name: string;
  roles: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password =
      typeof body.password === "string" ? body.password.trim() : "";

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password are required" },
        { status: 400 }
      );
    }

    const wpRestUrl = process.env.WORDPRESS_REST_API_URL;
    if (!wpRestUrl) {
      return NextResponse.json(
        { success: false, message: "WORDPRESS_REST_API_URL not configured" },
        { status: 500 }
      );
    }

    const credentials = Buffer.from(`${username}:${password}`).toString("base64");
    const response = await fetch(`${wpRestUrl}/users/me?context=edit`, {
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (response.status === 401 || response.status === 403) {
      let wpMessage = "";
      try {
        const err = (await response.json()) as { message?: string; code?: string };
        wpMessage = err.message || err.code || "";
      } catch {
        wpMessage = "";
      }
      return NextResponse.json(
        {
          success: false,
          message: wpMessage
            ? `WordPress rejected credentials: ${wpMessage}`
            : "Invalid credentials. Use your WordPress username and an Application Password.",
        },
        { status: 401 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `WordPress auth failed (${response.status})` },
        { status: 502 }
      );
    }

    const user = (await response.json()) as WpMeResponse;
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isAdmin = roles.includes("administrator");

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Admin access required" },
        { status: 403 }
      );
    }

    const token = await createSession({
      wordpressId: user.id.toString(),
      email: user.email,
      displayName: user.name || username,
      roles,
      isAdmin,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        wordpressId: user.id.toString(),
        email: user.email,
        displayName: user.name || username,
        roles,
        isAdmin,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isNetworkError =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("ETIMEDOUT");
    return NextResponse.json(
      {
        success: false,
        message: isNetworkError
          ? `Cannot reach WordPress: ${message}`
          : "Internal server error",
      },
      { status: 500 }
    );
  }
}
