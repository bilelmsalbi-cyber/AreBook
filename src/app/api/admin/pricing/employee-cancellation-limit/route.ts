import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import { requireAdminRole } from "@/lib/rbac";
import { validateNonNegativeNumber, ValidationError } from "@/lib/pricing/validation";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await prisma.employeeCancellationLimit.findFirst();
  return NextResponse.json({ limit });
}

// PUT — replace the single configured limit. ADMIN-only. Until this is
// set at least once, employees cannot cancel any booking at all — see
// checkEmployeeCancellationLimit in lib/cancellation.ts.
export async function PUT(request: NextRequest) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireAdminRole(session.user.role);
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const maxRefundAmount = validateNonNegativeNumber(
      body.maxRefundAmount,
      "Employee cancellation limit"
    );

    const saved = await prisma.$transaction(async (tx) => {
      await tx.employeeCancellationLimit.deleteMany({});
      return tx.employeeCancellationLimit.create({ data: { maxRefundAmount } });
    });

    return NextResponse.json({ limit: saved });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Save employee cancellation limit error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}