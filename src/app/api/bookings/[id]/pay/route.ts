import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

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

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: true,
        trip: true,
        linkedBooking: { include: { payment: true, trip: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // A round-trip pair shares a single Payment, held by whichever leg
    // was checked out first (see checkout/route.ts). This lets /pay be
    // called with either leg's id and still resolve to the right invoice.
    const paymentBooking = booking.payment ? booking : booking.linkedBooking;

    if (!paymentBooking?.payment) {
      return NextResponse.json(
        { error: "No invoice found for this booking. Please review your booking first." },
        { status: 400 }
      );
    }

    if (paymentBooking.status === "CONFIRMED" || paymentBooking.payment.status === "PAID") {
      return NextResponse.json(
        { error: "This booking has already been paid" },
        { status: 409 }
      );
    }

    // The 7-minute seat hold applies here too, not just at checkout. Both
    // legs of a round trip share the same expiresAt (set together at
    // creation in api/bookings/route.ts), so checking the payment-holding
    // leg is enough. Without this check, a lapsed hold could still be paid
    // for after the seat was silently freed up for someone else to book —
    // risking a double-booked seat.
    if (paymentBooking.expiresAt && paymentBooking.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This booking hold has expired. Please search and book again." },
        { status: 410 }
      );
    }

    const origin = request.nextUrl.origin;

    // Build a route label covering both legs when this is a round trip.
    const legs = [booking.trip, booking.linkedBooking?.trip].filter(
      (t): t is NonNullable<typeof t> => Boolean(t)
    );
    const routeLabel =
      legs.length > 1
        ? `${legs[0].departingPlace} \u21C4 ${legs[0].destination}`
        : `${legs[0].departingPlace} \u2192 ${legs[0].destination}`;

    // The accessToken lives only on the OUTBOUND booking row (see
    // api/bookings/route.ts) — `booking` here is always the one the
    // frontend has been carrying through the whole flow (invoice's
    // handlePayment always calls this with the outbound id), so
    // `booking.accessToken`, not `paymentBooking.accessToken`, is the
    // right one to forward. This is what lets the guest (not logged in,
    // pnr doesn't exist until the webhook fires) view /payment/success
    // and /payment/cancel afterward.
    const tokenParam = booking.accessToken ? `&token=${booking.accessToken}` : "";
    const tokenOnlyParam = booking.accessToken ? `?token=${booking.accessToken}` : "";

    // NOTE: Stripe test account settles in EUR, so we pass the invoice
    // total (computed in TND) as EUR cents. This is a simplification for
    // the test/learning environment, not a real currency conversion.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `AreBook — Booking #${paymentBooking.id} (${routeLabel})`,
            },
            unit_amount: Math.round(paymentBooking.payment.amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/payment/success/${paymentBooking.id}?session_id={CHECKOUT_SESSION_ID}${tokenParam}`,
      cancel_url: `${origin}/payment/cancel/${paymentBooking.id}${tokenOnlyParam}`,
      metadata: {
        bookingId: String(paymentBooking.id),
      },
    });

    await prisma.booking.update({
      where: { id: paymentBooking.id },
      data: { stripeSessionId: session.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json({ error: "Could not start payment" }, { status: 500 });
  }
}