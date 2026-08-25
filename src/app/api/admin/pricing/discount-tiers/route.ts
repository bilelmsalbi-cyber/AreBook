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

  const tiers = await prisma.roundTripDiscountTier.findMany({
    orderBy: { minTotal: "asc" },
  });

  return NextResponse.json({ tiers });
}

// PUT — bulk replace the entire tier set in one atomic operation. ADMIN-only.
//
// Tiers are only meaningful as a whole set (no gaps, no overlap, starts at
// 0, ends open-ended) — an add or a delete on its own can temporarily
// break that shape even when the admin's end goal is valid. So instead of
// per-row create/update/delete, the client sends the FULL proposed list
// after all local edits, and this route validates + writes it as a single
// transaction. Row ids are not preserved across saves (old rows are
// dropped and new ones created) — safe here because nothing else in the
// schema references a tier by id; the pricing engine matches tiers by
// value at calculation time, not by id.
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
      const minTotal = validateNonNegativeNumber(t.minTotal, `Tier ${i + 1}: Minimum total`);
      const maxTotal = validateOptionalNonNegative(t.maxTotal, `Tier ${i + 1}: Maximum total`);
      const discountPercent = validatePercent(t.discountPercent, `Tier ${i + 1}: Discount percent`);
      return { minTotal, maxTotal, discountPercent };
    });

    validateTierSetIntegrity(validated.map((t) => ({ min: t.minTotal, max: t.maxTotal })));

    const saved = await prisma.$transaction(async (tx) => {
      await tx.roundTripDiscountTier.deleteMany({});
      await tx.roundTripDiscountTier.createMany({ data: validated });
      return tx.roundTripDiscountTier.findMany({ orderBy: { minTotal: "asc" } });
    });

    return NextResponse.json({ tiers: saved });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Save discount tiers error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}