import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { buildPaymentConfirmationEmail } from "@/lib/emails/paymentConfirmation";

function generatePnrCandidate(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function generateUniquePnr(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generatePnrCandidate();
    const existing = await prisma.booking.findUnique({ where: { pnr: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique PNR after 10 attempts");
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    // Always the leg the checkout session was created from (see pay/route.ts).
    const bookingId = parseInt(session.metadata?.bookingId || "", 10);

    if (!isNaN(bookingId)) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          trip: { include: { plane: true } },
          passengers: { include: { person: true } },
          payment: true,
          linkedBooking: {
            include: { trip: { include: { plane: true } } },
          },
        },
      });

      // Idempotency guard: only act once, even if Stripe retries the webhook.
      // booking.paymentId must exist — checkout/route.ts always sets it
      // before a Stripe session can be created.
      if (booking && booking.status !== "CONFIRMED" && booking.paymentId) {
        const pnr = await generateUniquePnr();

        const writes = [
          prisma.booking.update({
            where: { id: bookingId },
            data: { status: "CONFIRMED", pnr },
          }),
          // Booking → Payment now, so we update by the Payment's own id,
          // not by a bookingId field (Payment no longer has one).
          prisma.payment.update({
            where: { id: booking.paymentId },
            data: { status: "PAID", paymentDate: new Date() },
          }),
        ];

        // Round-trip: confirm the linked leg too. It shares the same
        // paymentId already (set together in checkout/route.ts) and
        // intentionally has no pnr of its own — resolved via linkedBooking.
        if (booking.linkedBooking) {
          writes.push(
            prisma.booking.update({
              where: { id: booking.linkedBooking.id },
              data: { status: "CONFIRMED" },
            })
          );
        }

        await prisma.$transaction(writes);

        // One combined confirmation email, covering both legs when present.
        const firstPassenger = booking.passengers[0];
        if (firstPassenger) {
          const { html, text } = buildPaymentConfirmationEmail({
            pnr,
            firstName: firstPassenger.person.firstName,
            departingPlace: booking.trip.departingPlace,
            destination: booking.trip.destination,
            departureDateTime: booking.trip.departureDateTime.toISOString(),
            aircraftType: booking.trip.plane.aircraftType,
            totalAmount: booking.payment?.amount ?? 0,
            returnLeg: booking.linkedBooking
              ? {
                  departingPlace: booking.linkedBooking.trip.departingPlace,
                  destination: booking.linkedBooking.trip.destination,
                  departureDateTime:
                    booking.linkedBooking.trip.departureDateTime.toISOString(),
                  aircraftType: booking.linkedBooking.trip.plane.aircraftType,
                }
              : undefined,
          });

          try {
            await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
              to: firstPassenger.person.email,
              subject: `Your AreBook booking is confirmed — PNR ${pnr}`,
              html,
              text,
            });
          } catch (emailError) {
            console.error("Failed to send confirmation email:", emailError);
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}