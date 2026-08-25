import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import { requireAdminRole } from "@/lib/rbac";
import {
  validateNonNegativeNumber,
  validateOptionalNonNegative,
  validatePercent,
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

// PUT — bulk replace the entire tier set in one atomic operation. ADMIN-only.
// Same rationale as discount-tiers/route.ts: tiers are only meaningful as
// a whole set, so the client sends the full proposed list and this route
// validates + writes it as a single transaction. Row ids are not
// preserved across saves.
export async function PUT(request: NextRequest) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireAdminRole(session.user.role);
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const rawTiers = body.tiers;

    if (!Array.isArray(rawTiers)) {
      return NextResponse.json({ error: "Expected a list of tiers." }, { status: 400 });
    }

    const validated = rawTiers.map((t, i) => {
      const minHoursBefore = validateNonNegativeNumber(
        t.minHoursBefore,
        `Tier ${i + 1}: Minimum hours before`
      );
      const maxHoursBefore = validateOptionalNonNegative(
        t.maxHoursBefore,
        `Tier ${i + 1}: Maximum hours before`
      );
      const businessDeductionPercent = validatePercent(
        t.businessDeductionPercent,
        `Tier ${i + 1}: Business deduction percent`
      );
      const guestDeductionPercent = validatePercent(
        t.guestDeductionPercent,
        `Tier ${i + 1}: Guest deduction percent`
      );
      return { minHoursBefore, maxHoursBefore, businessDeductionPercent, guestDeductionPercent };
    });

    validateTierSetIntegrity(
      validated.map((t) => ({ min: t.minHoursBefore, max: t.maxHoursBefore }))
    );

    const saved = await prisma.$transaction(async (tx) => {
      await tx.cancellationTier.deleteMany({});
      await tx.cancellationTier.createMany({ data: validated });
      return tx.cancellationTier.findMany({ orderBy: { minHoursBefore: "asc" } });
    });

    return NextResponse.json({ tiers: saved });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Save cancellation tiers error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}