import { NextResponse } from "next/server";

const PLACEHOLDER = "PLACEHOLDER_CHANGE_ME";

const TRACKED_FIELDS = [
  "WORDPRESS_URL",
  "WORDPRESS_USERNAME",
  "WORDPRESS_APP_PASSWORD",
  "ABSTRACT_API_KEY",
  "SUPPORT_EMAIL",
  "ACCOUNT_LOGIN_URL",
];

export async function GET() {
  const required = process.env.SETUP_REQUIRED === "true";

  const missingFields = TRACKED_FIELDS.filter((field) => {
    const val = process.env[field];
    return !val || val === PLACEHOLDER || val.startsWith("PLACEHOLDER");
  });

  return NextResponse.json({ required, missingFields });
}
