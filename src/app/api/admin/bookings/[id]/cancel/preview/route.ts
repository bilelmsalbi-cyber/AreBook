import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth-admin";
import {
  resolvePrimaryBooking,
  checkCancellationEligibility,
  computeRefundBreakdown,
  verifyOwnership,
  checkEmployeeCancellationLimit,
  bookingRequiresManualRefund,
  type AuthContext,
} from "@/lib/cancellation";

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

    const limitCheck = await checkEmployeeCancellationLimit(
      breakdown.finalRefundAmount,
      role
    );
    if (!limitCheck.ok) {
      return NextResponse.json({ error: limitCheck.error }, { status: limitCheck.status });
    }

    // Surfaced here (read-only check, nothing mutated) so the admin
    // dashboard can warn the caller BEFORE the retype-to-confirm step,
    // instead of only discovering the automatic-refund block at
    // execution time. Only ADMIN can act on this flag — EMPLOYEE sees
    // it too but the UI must not offer the override to them.
    const requiresManualRefund = bookingRequiresManualRefund(booking, breakdown);

    return NextResponse.json({
      bookingId: booking.id,
      ...breakdown,
      requiresManualRefund,
    });
  } catch (error) {
    console.error("Error previewing admin cancellation:", error);
    return NextResponse.json(
      { error: "Error previewing cancellation" },
      { status: 500 }
    );
  }
}