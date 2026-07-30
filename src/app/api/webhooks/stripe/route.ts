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
    const bookingId = parseInt(session.metadata?.bookingId || "", 10);

    if (!isNaN(bookingId)) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          trip: { include: { plane: true } },
          passengers: { include: { person: true } },
          payment: true,
        },
      });

      // Idempotency guard: only act once, even if Stripe retries the webhook
      if (booking && booking.status !== "CONFIRMED") {
        const pnr = await generateUniquePnr();

        await prisma.$transaction([
          prisma.booking.update({
            where: { id: bookingId },
            data: { status: "CONFIRMED", pnr },
          }),
          prisma.payment.update({
            where: { bookingId },
            data: { status: "PAID", paymentDate: new Date() },
          }),
        ]);

        // Send confirmation email to the first passenger
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
            // Don't fail the whole webhook if email sending fails —
            // the booking is already confirmed and paid, email is best-effort
            console.error("Failed to send confirmation email:", emailError);
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}