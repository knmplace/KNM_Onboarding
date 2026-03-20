import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateEmail } from "@/lib/abstract-api";

/**
 * POST /api/validate-email - Validate a user's email via Abstract API
 * Body: { userId: number } (onboarding_state.id)
 */
export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const user = await prisma.onboardingState.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await validateEmail(user.email);

    // Save validation results to DB
    const updated = await prisma.onboardingState.update({
      where: { id: userId },
      data: {
        emailValid: result.valid,
        emailQualityScore: result.qualityScore,
        emailDeliverable: result.deliverable,
        emailIsDisposable: result.isDisposable,
        emailIsFreeEmail: result.isFreeEmail,
        emailIsCatchAll: result.isCatchAll,
        emailIsBreached: result.isBreached,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        emailValidationRaw: result.raw as any,
        emailValidatedAt: new Date(),
      },
    });

    return NextResponse.json({ user: updated, validation: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
