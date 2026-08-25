import { prisma } from "@/lib/prisma";
import { calculateCancellationRefund } from "@/lib/pricing/engine";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------
// Shared by both /cancel/preview and /cancel. Keeping this logic in one
// place guarantees the numbers a customer sees in the preview are
// exactly the numbers actually applied at execution time — computing it
// twice in two separate route files would risk the two drifting apart.
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
// Ownership verification — two ways to prove you're allowed to act on
// this booking:
//   - "customer": a logged-in session whose customerId matches the
//     booking's customerId.
//   - "guest": the PNR + last name, re-checked here (not just trusted
//     from an earlier /lookup call) — the same requirement enforced in
//     /api/bookings/lookup applies to every action, not just the search.
//
// Critical rule (agreed earlier): a booking created under a customer
// account can ONLY ever be managed through that account. The guest path
// always rejects such bookings, even with a fully correct PNR + last
// name — same generic message as a genuine mismatch, so the response
// never confirms that a PNR/name pair was valid.
// ---------------------------------------------------------------------

export type AuthContext =
  | { type: "customer"; customerId: number }
  | { type: "guest"; pnr: string; lastName: string };

const guestNotFound: CancellationCheck = {
  ok: false,
  error: "No booking found. Please check your PNR and last name.",
  status: 404,
};

export function verifyOwnership(
  booking: BookingForCancellation,
  authContext: AuthContext
): CancellationCheck {
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
// ownership is checked separately via verifyOwnership above.
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