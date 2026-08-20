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

// PATCH — update an existing discount tier. ADMIN-only.
// Re-validates the whole resulting set (all tiers, with this one replaced)
// before writing, since a change here can create a gap/overlap with its
// neighbors even if the row itself looks valid in isolation.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireAdminRole(session.user.role);
  if (forbidden) return forbidden;

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "Invalid tier ID." }, { status: 400 });
  }

  try {
    const existing = await prisma.roundTripDiscountTier.findUnique({ where: { id: targetId } });
    if (!existing) {
      return NextResponse.json({ error: "Tier not found." }, { status: 404 });
    }

    const body = await request.json();
    const minTotal =
      body.minTotal !== undefined
        ? validateNonNegativeNumber(body.minTotal, "Minimum total")
        : existing.minTotal;
    const maxTotal =
      body.maxTotal !== undefined
        ? validateOptionalNonNegative(body.maxTotal, "Maximum total")
        : existing.maxTotal;
    const discountPercent =
      body.discountPercent !== undefined
        ? validatePercent(body.discountPercent, "Discount percent")
        : existing.discountPercent;

    validateTierRange(minTotal, maxTotal, "Minimum total", "Maximum total");

    const allTiers = await prisma.roundTripDiscountTier.findMany();
    const resultingSet = allTiers.map((t) =>
      t.id === targetId ? { min: minTotal, max: maxTotal } : { min: t.minTotal, max: t.maxTotal }
    );
    validateTierSetIntegrity(resultingSet);

    const updated = await prisma.roundTripDiscountTier.update({
      where: { id: targetId },
      data: { minTotal, maxTotal, discountPercent },
    });

    return NextResponse.json({ tier: updated });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Update discount tier error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

// DELETE — remove a discount tier. ADMIN-only.
// Re-validates the resulting set (all tiers minus this one) BEFORE
// deleting — if removing it would leave a gap, the delete is rejected and
// nothing is written.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireAdminRole(session.user.role);
  if (forbidden) return forbidden;

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "Invalid tier ID." }, { status: 400 });
  }

  try {
    const allTiers = await prisma.roundTripDiscountTier.findMany();
    const remaining = allTiers
      .filter((t) => t.id !== targetId)
      .map((t) => ({ min: t.minTotal, max: t.maxTotal }));

    validateTierSetIntegrity(remaining);

    await prisma.roundTripDiscountTier.delete({ where: { id: targetId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: `Cannot delete this tier: ${error.message} Adjust the neighboring tiers first.`,
        },
        { status: 409 }
      );
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Tier not found." }, { status: 404 });
    }
    console.error("Delete discount tier error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}