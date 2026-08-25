import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isRateLimited, cleanupOldBuckets } from "@/lib/rateLimit";
import {
  resolvePrimaryBooking,
  checkCancellationEligibility,
  computeRefundBreakdown,
  verifyOwnership,
  type AuthContext,
} from "@/lib/cancellation";

// ---------------------------------------------------------------------
// POST /api/bookings/[id]/cancel/preview
// Read-only: computes what a cancellation would refund, without
// cancelling anything or contacting Stripe.
//
// Two ways to prove you may act on this booking:
//   - Logged in: session's customerId must match the booking's.
//   - Guest: request body must include { pnr, lastName } — re-verified
//     here from scratch (not trusted from an earlier /lookup call), and
//     never accepted at all for a booking that belongs to an account
//     (see verifyOwnership in lib/cancellation.ts).
// The guest path is rate-limited the same way /api/bookings/lookup is,
// since it's another unauthenticated surface that takes a guessable PNR.
// ---------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookingId = parseInt(id, 10);

    if (isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }

    let body: { pnr?: string; lastName?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine for the logged-in path.
    }

    const session = await auth();
    const customerId = session?.user?.customerId
      ? parseInt(session.user.customerId, 10)
      : null;

    let authContext: AuthContext;

    if (customerId) {
      authContext = { type: "customer", customerId };
    } else {
      const pnr = typeof body.pnr === "string" ? body.pnr.trim() : "";
      const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";

      if (!pnr || !lastName) {
        return NextResponse.json(
          { error: "Log in, or provide your PNR and last name." },
          { status: 401 }
        );
      }

      const ip = request.headers.get("x-forwarded-for") || "unknown";
      cleanupOldBuckets();
      if (isRateLimited(ip)) {
        return NextResponse.json(
          { error: "Too many attempts. Please wait a moment and try again." },
          { status: 429 }
        );
      }

      authContext = { type: "guest", pnr, lastName };
    }

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

    return NextResponse.json({ bookingId: booking.id, ...breakdown });
  } catch (error) {
    console.error("Error previewing cancellation:", error);
    return NextResponse.json(
      { error: "Error previewing cancellation" },
      { status: 500 }
    );
  }
}