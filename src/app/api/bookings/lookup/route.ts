import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, cleanupOldBuckets } from "@/lib/rateLimit";

// ---------------------------------------------------------------------
// Lets a guest (not logged in) find their own booking using the PNR and
// the last name on the booking — the same two pieces of information
// airlines have traditionally required for this, since neither alone is
// enough to prove ownership.
//
// Security notes:
// - POST, not GET: keeps the PNR/last name out of the URL, browser
//   history, and server access logs.
// - Every failure path (PNR not found, name mismatch, not confirmed,
//   already departed) returns the exact same generic message and status
//   code, so a caller can't use the response to tell which part was
//   wrong — that would make PNRs easier to guess piece by piece.
// - Rate-limited per IP, reusing the same limiter as booking creation,
//   since a 6-character PNR is guessable if attempts are unlimited.
// - Returns full booking + passenger details in a single response, so
//   the UI never needs a second, id-based request for guest bookings —
//   there is no unauthenticated-by-id endpoint to probe.
// ---------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    cleanupOldBuckets();

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const pnr = typeof body.pnr === "string" ? body.pnr.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";

    if (!pnr || !lastName) {
      return NextResponse.json(
        { error: "PNR and last name are required." },
        { status: 400 }
      );
    }

    // Reused for every failure branch below — see security notes above.
    const notFound = () =>
      NextResponse.json(
        { error: "No booking found. Please check your PNR and last name." },
        { status: 404 }
      );

    // The pnr column only ever holds a value on the outbound (primary)
    // leg of a booking — confirmed against checkout/route.ts and the
    // Stripe webhook — so finding a row by pnr always gives us the
    // outbound leg directly, never a return leg.
    const booking = await prisma.booking.findUnique({
      where: { pnr },
      include: {
        trip: { include: { plane: true } },
        passengers: {
          include: { person: true, document: true, specialRequests: true },
        },
        payment: true,
        linkedBooking: {
          include: {
            trip: { include: { plane: true } },
            passengers: {
              include: { person: true, document: true, specialRequests: true },
            },
          },
        },
      },
    });

    if (!booking) {
      return notFound();
    }

    const nameMatches = booking.passengers.some(
      (p) => p.person.lastName.trim().toLowerCase() === lastName.toLowerCase()
    );
    if (!nameMatches) {
      return notFound();
    }

    // A booking created under a customer account can only ever be managed
    // through that account — never through the guest PNR+last-name path,
    // even when both are correct. We deliberately return the exact same
    // generic "not found" response here (not a distinct "please log in"
    // message): a different message would let someone confirm a PNR/name
    // pair is valid just by seeing which error comes back, without ever
    // proving they own the account.
    if (booking.customerId !== null) {
      return notFound();
    }

    // Only surface bookings that are actually actionable: paid, and the
    // outbound leg hasn't departed yet — same rule as the logged-in "My
    // Bookings" list, and the rule cancellation will enforce next.
    if (booking.status !== "CONFIRMED") {
      return notFound();
    }
    if (booking.trip.departureDateTime < new Date()) {
      return notFound();
    }

    return NextResponse.json({ booking });
  } catch (error) {
    console.error("Error looking up booking:", error);
    return NextResponse.json(
      { error: "Error looking up booking" },
      { status: 500 }
    );
  }
}