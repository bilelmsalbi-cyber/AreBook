import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth-admin";
import {
  resolvePrimaryBooking,
  checkCancellationEligibility,
  computeRefundBreakdown,
  verifyOwnership,
  checkEmployeeCancellationLimit,
  type AuthContext,
} from "@/lib/cancellation";

// ---------------------------------------------------------------------
// POST /api/admin/bookings/[id]/cancel/preview
// Read-only: computes what a cancellation would refund, without
// cancelling anything or contacting Stripe. Available to both ADMIN and
// EMPLOYEE — unlike other admin mutation routes, this feature is
// intentionally NOT gated by requireAdminRole (see rationale in
// lib/cancellation.ts: employees are capped by amount instead, via
// checkEmployeeCancellationLimit).
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

    // Checked in preview too (not just at execution) so an employee
    // sees the "ask an Admin" message immediately, before going through
    // the retype-to-confirm step for a cancellation that will be
    // refused anyway.
    const limitCheck = await checkEmployeeCancellationLimit(
      breakdown.finalRefundAmount,
      role
    );
    if (!limitCheck.ok) {
      return NextResponse.json({ error: limitCheck.error }, { status: limitCheck.status });
    }

    return NextResponse.json({ bookingId: booking.id, ...breakdown });
  } catch (error) {
    console.error("Error previewing admin cancellation:", error);
    return NextResponse.json(
      { error: "Error previewing cancellation" },
      { status: 500 }
    );
  }
}