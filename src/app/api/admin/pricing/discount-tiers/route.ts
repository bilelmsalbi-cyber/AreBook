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

  const tiers = await prisma.roundTripDiscountTier.findMany({
    orderBy: { minTotal: "asc" },
  });

  return NextResponse.json({ tiers });
}

// POST — create a new discount tier. ADMIN-only.
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
    const minTotal = validateNonNegativeNumber(body.minTotal, "Minimum total");
    const maxTotal = validateOptionalNonNegative(body.maxTotal, "Maximum total");
    const discountPercent = validatePercent(body.discountPercent, "Discount percent");

    validateTierRange(minTotal, maxTotal, "Minimum total", "Maximum total");

    const existing = await prisma.roundTripDiscountTier.findMany();
    const resultingSet = [
      ...existing.map((t) => ({ min: t.minTotal, max: t.maxTotal })),
      { min: minTotal, max: maxTotal },
    ];
    validateTierSetIntegrity(resultingSet);

    const created = await prisma.roundTripDiscountTier.create({
      data: { minTotal, maxTotal, discountPercent },
    });

    return NextResponse.json({ tier: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Create discount tier error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}