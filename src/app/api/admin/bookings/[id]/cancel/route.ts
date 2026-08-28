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

    let body: { manualOverride?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine — manualOverride just defaults to false.
    }

    const adminId = parseInt(session.user.adminId, 10);
    const authContext: AuthContext = { type: "admin", adminId, role };

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

    // The client's manualOverride flag is NEVER trusted on its own —
    // only honored when this server independently confirms the caller
    // is ADMIN. An EMPLOYEE sending manualOverride: true (whether via a
    // modified request or a UI bug) is silently ignored here, so they
    // fall through to the normal guard in executeCancellation and get
    // the standard "contact support" refusal instead.
    const manualOverride =
      role === "ADMIN" && body.manualOverride === true ? { adminId } : undefined;

    const result = await executeCancellation(booking, breakdown, true, manualOverride);

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
      manualOverrideUsed: result.manualOverrideUsed,
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