import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import { requireAdminRole } from "@/lib/rbac";
import {
  validateNonNegativeNumber,
  validateOptionalNonNegative,
  validatePercent,
  validateTierRange,
  validateTierSetIntegrity,
  ValidationError,
} from "@/lib/pricing/validation";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tiers = await prisma.cancellationTier.findMany({
    orderBy: { minHoursBefore: "asc" },
  });

  return NextResponse.json({ tiers });
}

// POST — create a new cancellation tier. ADMIN-only.
// Validates the tier itself, then re-validates the WHOLE resulting set
// (existing tiers + the new one) for gaps/overlaps before writing.
export async function POST(request: NextRequest) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireAdminRole(session.user.role);
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const minHoursBefore = validateNonNegativeNumber(body.minHoursBefore, "Minimum hours before");
    const maxHoursBefore = validateOptionalNonNegative(body.maxHoursBefore, "Maximum hours before");
    const businessDeductionPercent = validatePercent(
      body.businessDeductionPercent,
      "Business deduction percent"
    );
    const guestDeductionPercent = validatePercent(
      body.guestDeductionPercent,
      "Guest deduction percent"
    );

    validateTierRange(minHoursBefore, maxHoursBefore, "Minimum hours before", "Maximum hours before");

    const existing = await prisma.cancellationTier.findMany();
    const resultingSet = [
      ...existing.map((t) => ({ min: t.minHoursBefore, max: t.maxHoursBefore })),
      { min: minHoursBefore, max: maxHoursBefore },
    ];
    validateTierSetIntegrity(resultingSet);

    const created = await prisma.cancellationTier.create({
      data: { minHoursBefore, maxHoursBefore, businessDeductionPercent, guestDeductionPercent },
    });

    return NextResponse.json({ tier: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Create cancellation tier error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}