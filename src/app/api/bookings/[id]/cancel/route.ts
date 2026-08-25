import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { isRateLimited, cleanupOldBuckets } from "@/lib/rateLimit";
import { resend } from "@/lib/resend";
import { buildCancellationEmail } from "@/lib/emails/cancellationConfirmation";
import {
  resolvePrimaryBooking,
  checkCancellationEligibility,
  computeRefundBreakdown,
  verifyOwnership,
  type AuthContext,
} from "@/lib/cancellation";

// ---------------------------------------------------------------------
// POST /api/bookings/[id]/cancel
// Executes the cancellation: issues the real Stripe refund, then marks
// the booking(s) CANCELLED and the payment REFUNDED.
//
// Same two ownership paths as /cancel/preview (see comments there and in
// lib/cancellation.ts) — re-verified independently here rather than
// trusting that a prior preview call succeeded, since preview and
// execute are separate requests.
//
// If the payment has no stripePaymentIntentId on file and a non-zero
// refund is owed, the cancellation is REFUSED entirely rather than
// marking the booking cancelled without a real refund — losing a
// customer's money silently is worse than asking them to wait for
// manual handling.
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

    // Guard: can't safely refund real money without a payment_intent to
    // refund against. Refuse the whole operation rather than cancel the
    // booking without actually returning any money.
    if (breakdown.finalRefundAmount > 0 && !booking.payment!.stripePaymentIntentId) {
      console.error(
        `Booking ${booking.id}: cancellation blocked — refund of ${breakdown.finalRefundAmount} ` +
          `owed but payment ${booking.payment!.id} has no stripePaymentIntentId on file.`
      );
      return NextResponse.json(
        {
          error:
            "This booking can't be cancelled automatically right now. Please contact support.",
        },
        { status: 409 }
      );
    }

    // ---- Issue the Stripe refund first ----
    // Idempotency key tied to this booking's id: if this whole request
    // gets retried (e.g. the refund succeeded but our own DB update
    // below failed, and the customer or client retries), Stripe
    // recognizes the same key and returns the ORIGINAL refund instead of
    // creating a second one. This is what makes "please try again" a
    // genuinely safe instruction below, instead of a risk of double
    // refunding the customer.
    let stripeRefundId: string | null = null;
    if (breakdown.finalRefundAmount > 0) {
      const refund = await stripe.refunds.create(
        {
          payment_intent: booking.payment!.stripePaymentIntentId!,
          amount: Math.round(breakdown.finalRefundAmount * 100),
        },
        { idempotencyKey: `cancel-booking-${booking.id}` }
      );
      stripeRefundId = refund.id;
    }

    // ---- Now update our records, only after the refund succeeded ----
    // Retried a few times before giving up: DB hiccups are usually
    // transient, and — thanks to the idempotency key above — retrying
    // the whole endpoint later is also safe, since Stripe won't be
    // charged a second time.
    const performDbUpdates = () => {
      const writes = [
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED" },
        }),
        prisma.payment.update({
          where: { id: booking.payment!.id },
          data: { status: "REFUNDED" },
        }),
      ];

      // Round-trip: cancelling the outbound cancels the linked return leg
      // too — they were always sold, held, and paid for as a pair.
      if (booking.linkedBooking) {
        writes.push(
          prisma.booking.update({
            where: { id: booking.linkedBooking.id },
            data: { status: "CANCELLED" },
          })
        );
      }

      return prisma.$transaction(writes);
    };

    const MAX_DB_ATTEMPTS = 3;
    let dbError: unknown = null;

    for (let attempt = 1; attempt <= MAX_DB_ATTEMPTS; attempt++) {
      try {
        await performDbUpdates();
        dbError = null;
        break;
      } catch (err) {
        dbError = err;
        if (attempt < MAX_DB_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }
      }
    }

    if (dbError) {
      // The refund already happened at Stripe — this is a serious
      // reconciliation gap, not a routine failure. Logged loudly so it
      // gets manual attention, and the customer is told to contact
      // support with a reference rather than "try again" (retrying is
      // safe thanks to the idempotency key, but there's no point asking
      // the customer to do it themselves when it already failed 3 times).
      console.error(
        `CRITICAL: Stripe refund ${stripeRefundId} succeeded for booking ${booking.id} ` +
          `but the database update failed after ${MAX_DB_ATTEMPTS} attempts. Manual reconciliation needed.`,
        dbError
      );
      return NextResponse.json(
        {
          error:
            "Your refund was processed, but we couldn't confirm the cancellation due to a system error. Please contact support and mention this booking.",
          stripeRefundId,
        },
        { status: 500 }
      );
    }

    // ---- Send the cancellation email (best-effort) ----
    // Mirrors the webhook's confirmation email: the cancellation itself
    // has already fully succeeded at this point (refund issued, DB
    // updated), so a failure here must never be treated as a failure of
    // the cancellation — it's just logged.
    const firstPassenger = booking.passengers[0];
    if (firstPassenger) {
      const { html, text } = buildCancellationEmail({
        pnr: booking.pnr ?? "—",
        firstName: firstPassenger.person.firstName,
        departingPlace: booking.trip.departingPlace,
        destination: booking.trip.destination,
        departureDateTime: booking.trip.departureDateTime.toISOString(),
        aircraftType: booking.trip.plane.aircraftType,
        returnLeg: booking.linkedBooking
          ? {
              departingPlace: booking.linkedBooking.trip.departingPlace,
              destination: booking.linkedBooking.trip.destination,
              departureDateTime: booking.linkedBooking.trip.departureDateTime.toISOString(),
              aircraftType: booking.linkedBooking.trip.plane.aircraftType,
            }
          : undefined,
        ...breakdown,
      });

      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
          to: firstPassenger.person.email,
          subject: `Your AreBook booking has been cancelled — PNR ${booking.pnr ?? ""}`,
          html,
          text,
        });
      } catch (emailError) {
        console.error("Failed to send cancellation email:", emailError);
      }
    }

    return NextResponse.json({
      bookingId: booking.id,
      status: "CANCELLED",
      stripeRefundId,
      ...breakdown,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json(
      { error: "Error cancelling booking" },
      { status: 500 }
    );
  }
}