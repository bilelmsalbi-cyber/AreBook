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

// PATCH — update an existing cancellation tier. ADMIN-only.
// Re-validates the whole resulting set (all tiers, with this one replaced)
// before writing.
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
    const existing = await prisma.cancellationTier.findUnique({ where: { id: targetId } });
    if (!existing) {
      return NextResponse.json({ error: "Tier not found." }, { status: 404 });
    }

    const body = await request.json();
    const minHoursBefore =
      body.minHoursBefore !== undefined
        ? validateNonNegativeNumber(body.minHoursBefore, "Minimum hours before")
        : existing.minHoursBefore;
    const maxHoursBefore =
      body.maxHoursBefore !== undefined
        ? validateOptionalNonNegative(body.maxHoursBefore, "Maximum hours before")
        : existing.maxHoursBefore;
    const businessDeductionPercent =
      body.businessDeductionPercent !== undefined
        ? validatePercent(body.businessDeductionPercent, "Business deduction percent")
        : existing.businessDeductionPercent;
    const guestDeductionPercent =
      body.guestDeductionPercent !== undefined
        ? validatePercent(body.guestDeductionPercent, "Guest deduction percent")
        : existing.guestDeductionPercent;

    validateTierRange(minHoursBefore, maxHoursBefore, "Minimum hours before", "Maximum hours before");

    const allTiers = await prisma.cancellationTier.findMany();
    const resultingSet = allTiers.map((t) =>
      t.id === targetId
        ? { min: minHoursBefore, max: maxHoursBefore }
        : { min: t.minHoursBefore, max: t.maxHoursBefore }
    );
    validateTierSetIntegrity(resultingSet);

    const updated = await prisma.cancellationTier.update({
      where: { id: targetId },
      data: { minHoursBefore, maxHoursBefore, businessDeductionPercent, guestDeductionPercent },
    });

    return NextResponse.json({ tier: updated });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Update cancellation tier error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

// DELETE — remove a cancellation tier. ADMIN-only.
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
    const allTiers = await prisma.cancellationTier.findMany();
    const remaining = allTiers
      .filter((t) => t.id !== targetId)
      .map((t) => ({ min: t.minHoursBefore, max: t.maxHoursBefore }));

    validateTierSetIntegrity(remaining);

    await prisma.cancellationTier.delete({ where: { id: targetId } });
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
    console.error("Delete cancellation tier error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}