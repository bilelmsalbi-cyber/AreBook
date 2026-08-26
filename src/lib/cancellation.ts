import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { resend } from "@/lib/resend";
import { buildCancellationEmail } from "@/lib/emails/cancellationConfirmation";
import { calculateCancellationRefund } from "@/lib/pricing/engine";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------
// Shared by /cancel/preview and /cancel — both the customer-facing and
// admin-facing routes. Keeping this logic in one place guarantees the
// numbers anyone sees in a preview are exactly the numbers applied at
// execution time, and that the actual refund/DB-update/email sequence
// only exists once, regardless of who triggered it.
// ---------------------------------------------------------------------

const bookingWithCancellationInclude = {
  payment: true,
  trip: { include: { plane: true } },
  linkedBooking: { include: { trip: { include: { plane: true } } } },
  passengers: { include: { person: true } },
} satisfies Prisma.BookingInclude;

export type BookingForCancellation = Prisma.BookingGetPayload<{
  include: typeof bookingWithCancellationInclude;
}>;

// Resolves to the OUTBOUND (primary) booking regardless of which leg's id
// was passed in, since that's the row holding the pnr and Payment —
// mirrors the same resolution pay/route.ts already does.
export async function resolvePrimaryBooking(
  bookingId: number
): Promise<BookingForCancellation | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingWithCancellationInclude,
  });

  if (!booking) return null;

  // If this id belongs to a return leg (referenced by another booking's
  // linkedBookingId), resolve to that outbound booking instead.
  if (!booking.linkedBookingId) {
    const outbound = await prisma.booking.findFirst({
      where: { linkedBookingId: booking.id },
      include: bookingWithCancellationInclude,
    });
    if (outbound) return outbound;
  }

  return booking;
}

export type CancellationCheck =
  | { ok: true }
  | { ok: false; error: string; status: number };

// ---------------------------------------------------------------------
// Ownership verification — three ways to prove you're allowed to act on
// this booking:
//   - "customer": a logged-in session whose customerId matches the
//     booking's customerId.
//   - "guest": the PNR + last name, re-checked here (not just trusted
//     from an earlier /lookup call) — the same requirement enforced in
//     /api/bookings/lookup applies to every action, not just the search.
//   - "admin": a logged-in Admin or Employee acting from the admin
//     dashboard. Ownership doesn't apply to staff at all — they can act
//     on any booking regardless of who it belongs to. Rate limiting
//     (relevant to the guest path) doesn't apply here either, since the
//     caller is already authenticated via adminAuth().
//
// Critical rule (customer/guest only): a booking created under a
// customer account can ONLY ever be managed through that account via
// the guest path. The guest path always rejects such bookings, even
// with a fully correct PNR + last name — same generic message as a
// genuine mismatch, so the response never confirms that a PNR/name pair
// was valid. This rule does not apply to the admin path.
// ---------------------------------------------------------------------

export type AuthContext =
  | { type: "customer"; customerId: number }
  | { type: "guest"; pnr: string; lastName: string }
  | { type: "admin"; adminId: number; role: "ADMIN" | "EMPLOYEE" };

const guestNotFound: CancellationCheck = {
  ok: false,
  error: "No booking found. Please check your PNR and last name.",
  status: 404,
};

export function verifyOwnership(
  booking: BookingForCancellation,
  authContext: AuthContext
): CancellationCheck {
  if (authContext.type === "admin") {
    // Staff act on any booking — ownership doesn't apply to them.
    return { ok: true };
  }

  if (authContext.type === "customer") {
    if (booking.customerId !== authContext.customerId) {
      return { ok: false, error: "Forbidden", status: 403 };
    }
    return { ok: true };
  }

  // Guest path
  if (booking.customerId !== null) {
    return guestNotFound;
  }

  if (
    !booking.pnr ||
    booking.pnr.trim().toUpperCase() !== authContext.pnr.trim().toUpperCase()
  ) {
    return guestNotFound;
  }

  const nameMatches = booking.passengers.some(
    (p) => p.person.lastName.trim().toLowerCase() === authContext.lastName.trim().toLowerCase()
  );
  if (!nameMatches) {
    return guestNotFound;
  }

  return { ok: true };
}

// Business rules for whether this booking can be cancelled at all —
// ownership is checked separately via verifyOwnership above. Applies
// identically to customer, guest, and admin/employee cancellations —
// staff don't get to cancel a booking that has already departed either.
export function checkCancellationEligibility(
  booking: BookingForCancellation,
  now: Date = new Date()
): CancellationCheck {
  if (booking.status !== "CONFIRMED") {
    return {
      ok: false,
      error: "Only confirmed bookings can be cancelled",
      status: 409,
    };
  }

  if (!booking.payment) {
    return { ok: false, error: "No payment found for this booking", status: 409 };
  }

  // Cancellation is only allowed while the outbound leg hasn't departed
  // yet — once it has, the trip is already underway and cannot be
  // cancelled, even if a return leg is still in the future.
  if (booking.trip.departureDateTime < now) {
    return {
      ok: false,
      error:
        "This booking can no longer be cancelled — the outbound flight has already departed.",
      status: 409,
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------
// Employee cancellation cap — an EMPLOYEE may only process a
// cancellation whose actual refund payout (finalRefundAmount, i.e. real
// money leaving the company, not the original booking price) is at or
// under the limit an Admin has configured. ADMIN is never capped.
//
// Safe-by-default: if no limit has been configured yet at all, every
// employee cancellation is blocked until an Admin sets one — silently
// allowing unlimited employee refunds because a setting was never
// touched would be a much worse failure mode than temporarily blocking
// a legitimate cancellation.
// ---------------------------------------------------------------------

export async function checkEmployeeCancellationLimit(
  finalRefundAmount: number,
  role: "ADMIN" | "EMPLOYEE"
): Promise<CancellationCheck> {
  if (role === "ADMIN") return { ok: true };

  const limit = await prisma.employeeCancellationLimit.findFirst();

  if (!limit) {
    return {
      ok: false,
      error:
        "No employee cancellation limit has been configured yet. Please ask an Admin to set one in Pricing & Policies, or ask an Admin to process this cancellation.",
      status: 403,
    };
  }

  if (finalRefundAmount > limit.maxRefundAmount) {
    return {
      ok: false,
      error: `This refund (${finalRefundAmount.toFixed(2)} TND) exceeds your cancellation limit (${limit.maxRefundAmount.toFixed(2)} TND). Please ask an Admin to process this cancellation.`,
      status: 403,
    };
  }

  return { ok: true };
}

export type RefundBreakdown = {
  pnr: string | null;
  originalAmount: number;
  cancellationDeductionPercent: number;
  cancellationDeductionAmount: number;
  amountAfterCancellationDeduction: number;
  stripeFeeOnRefund: number;
  finalRefundAmount: number;
};

// Assumes eligibility has already been checked (booking.payment exists).
export async function computeRefundBreakdown(
  booking: BookingForCancellation,
  now: Date = new Date()
): Promise<RefundBreakdown> {
  const payment = booking.payment!;

  const { refundAmount, deductionPercent, deductionAmount } =
    await calculateCancellationRefund(
      payment.amount,
      booking.seatClass,
      booking.trip.departureDateTime,
      now
    );

  // Real Stripe fee % from the original payment, applied to the
  // cancellation-tier refund amount (not the original amount) — per
  // agreed policy. Missing data (older bookings, or a fee lookup that
  // failed at payment time) degrades gracefully to no fee deduction,
  // logged for manual accounting review rather than blocking the
  // customer's ability to cancel.
  let stripeFeeOnRefund = 0;
  if (payment.stripeFeeAmount != null && payment.amount > 0) {
    const originalFeeRate = payment.stripeFeeAmount / payment.amount;
    stripeFeeOnRefund = refundAmount * originalFeeRate;
  } else {
    console.warn(
      `Booking ${booking.id}: no stripeFeeAmount on file for payment ${payment.id}. ` +
        `Proceeding with 0 Stripe fee deduction — flag for manual review.`
    );
  }

  const finalRefundAmount = Math.max(0, refundAmount - stripeFeeOnRefund);

  return {
    pnr: booking.pnr,
    originalAmount: payment.amount,
    cancellationDeductionPercent: deductionPercent,
    cancellationDeductionAmount: deductionAmount,
    amountAfterCancellationDeduction: refundAmount,
    stripeFeeOnRefund,
    finalRefundAmount,
  };
}

// ---------------------------------------------------------------------
// Executes the cancellation: issues the real Stripe refund, then marks
// the booking(s) CANCELLED and the payment REFUNDED, then sends the
// confirmation email best-effort. Shared by the customer-facing and
// admin-facing /cancel routes so this financially sensitive sequence
// exists exactly once — see api/bookings/[id]/cancel/route.ts and
// api/admin/bookings/[id]/cancel/route.ts.
//
// Assumes ownership + eligibility (+ employee limit, where relevant)
// have already been checked by the caller.
// ---------------------------------------------------------------------

export type ExecuteCancellationResult =
  | { ok: true; stripeRefundId: string | null }
  | { ok: false; error: string; status: number; stripeRefundId?: string | null };

export async function executeCancellation(
  booking: BookingForCancellation,
  breakdown: RefundBreakdown
): Promise<ExecuteCancellationResult> {
  // Guard: can't safely refund real money without a payment_intent to
  // refund against. Refuse the whole operation rather than cancel the
  // booking without actually returning any money.
  if (breakdown.finalRefundAmount > 0 && !booking.payment!.stripePaymentIntentId) {
    console.error(
      `Booking ${booking.id}: cancellation blocked — refund of ${breakdown.finalRefundAmount} ` +
        `owed but payment ${booking.payment!.id} has no stripePaymentIntentId on file.`
    );
    return {
      ok: false,
      error:
        "This booking can't be cancelled automatically right now. Please contact support.",
      status: 409,
    };
  }

  // ---- Issue the Stripe refund first ----
  // Idempotency key tied to this booking's id: if this whole request
  // gets retried (e.g. the refund succeeded but our own DB update below
  // failed, and the caller retries), Stripe recognizes the same key and
  // returns the ORIGINAL refund instead of creating a second one. This
  // is what makes "please try again" a genuinely safe instruction below,
  // instead of a risk of double refunding.
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
    // gets manual attention.
    console.error(
      `CRITICAL: Stripe refund ${stripeRefundId} succeeded for booking ${booking.id} ` +
        `but the database update failed after ${MAX_DB_ATTEMPTS} attempts. Manual reconciliation needed.`,
      dbError
    );
    return {
      ok: false,
      error:
        "The refund was processed, but we couldn't confirm the cancellation due to a system error. Please contact support and mention this booking.",
      status: 500,
      stripeRefundId,
    };
  }

  // ---- Send the cancellation email (best-effort) ----
  // The cancellation itself has already fully succeeded at this point
  // (refund issued, DB updated), so a failure here must never be
  // treated as a failure of the cancellation — it's just logged.
  const firstPassenger = booking.passengers[0];
  if (firstPassenger) {
    const { html, text } = buildCancellationEmail({
      ...breakdown,
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

  return { ok: true, stripeRefundId };
}