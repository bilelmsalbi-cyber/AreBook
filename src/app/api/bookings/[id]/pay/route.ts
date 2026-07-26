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
      include: { payment: true, trip: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (!booking.payment) {
      return NextResponse.json(
        { error: "No invoice found for this booking. Please review your booking first." },
        { status: 400 }
      );
    }
    if (booking.status === "CONFIRMED" || booking.payment.status === "PAID") {
      return NextResponse.json(
        { error: "This booking has already been paid" },
        { status: 409 }
      );
    }

    const origin = request.nextUrl.origin;

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
              name: `AreBook — Booking #${booking.id} (${booking.trip.departingPlace} → ${booking.trip.destination})`,
            },
            unit_amount: Math.round(booking.payment.amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/payment/success/${booking.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment/cancel/${booking.id}`,
      metadata: {
        bookingId: String(booking.id),
      },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeSessionId: session.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json({ error: "Could not start payment" }, { status: 500 });
  }
}