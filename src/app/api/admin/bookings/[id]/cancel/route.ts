import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth-admin";
import {
  resolvePrimaryBooking,
  checkCancellationEligibility,
  computeRefundBreakdown,
  verifyOwnership,
  checkEmployeeCancellationLimit,
  executeCancellation,
  type AuthContext,
} from "@/lib/cancellation";

// ---------------------------------------------------------------------
// POST /api/admin/bookings/[id]/cancel
// Executes the cancellation from the admin dashboard. Available to both
// ADMIN and EMPLOYEE (see rationale in preview/route.ts and
// lib/cancellation.ts) — intentionally NOT gated by requireAdminRole.
//
// Ownership never applies to staff (see verifyOwnership), and the same
// CancellationTier deduction is applied as everywhere else — no
// "full refund" override exists for staff.
// ---------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await adminAuth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "EMPLOYEE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const bookingId = parseInt(id, 10);
    if (isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }

    const authContext: AuthContext = {
      type: "admin",
      adminId: parseInt(session.user.adminId, 10),
      role,
    };

    const booking = await resolvePrimaryBooking(bookingId);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const ownership = verifyOwnership(booking, authContext);
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status });
    }

    const eligibility = checkCancellationEligibility(booking);
    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.error }, { status: eligibility.status });
    }

    const breakdown = await computeRefundBreakdown(booking);

    // Re-checked here independently of preview — never trust a prior
    // preview call, same rationale applied everywhere else in this flow.
    const limitCheck = await checkEmployeeCancellationLimit(
      breakdown.finalRefundAmount,
      role
    );
    if (!limitCheck.ok) {
      return NextResponse.json({ error: limitCheck.error }, { status: limitCheck.status });
    }

    const result = await executeCancellation(booking, breakdown);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, stripeRefundId: result.stripeRefundId ?? undefined },
        { status: result.status }
      );
    }

    return NextResponse.json({
      bookingId: booking.id,
      status: "CANCELLED",
      stripeRefundId: result.stripeRefundId,
      ...breakdown,
    });
  } catch (error) {
    console.error("Error cancelling booking (admin):", error);
    return NextResponse.json(
      { error: "Error cancelling booking" },
      { status: 500 }
    );
  }
}