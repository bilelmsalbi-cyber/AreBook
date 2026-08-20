import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, cleanupOldBuckets } from "@/lib/rateLimit";

const HOLD_MINUTES = 7;

async function checkSeatAvailability(
  tripId: number,
  seatClass: "GUEST" | "BUSINESS",
  seatsNeeded: number
) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { plane: true },
  });

  if (!trip) {
    return { ok: false as const, error: "Trip not found", status: 404 };
  }

  const totalSeats =
    seatClass === "BUSINESS" ? trip.plane.nbrBusinessSeats : trip.plane.nbrGuestSeats;

  const activeBookings = await prisma.booking.findMany({
    where: {
      tripId,
      seatClass,
      OR: [
        { status: "CONFIRMED" },
        { status: "PENDING", expiresAt: { gt: new Date() } },
      ],
    },
    select: { seatsHeld: true },
  });

  const seatsTaken = activeBookings.reduce((sum, b) => sum + b.seatsHeld, 0);
  const seatsAvailable = totalSeats - seatsTaken;

  if (seatsAvailable < seatsNeeded) {
    return {
      ok: false as const,
      error: "Not enough seats available in this class",
      status: 409,
    };
  }

  return { ok: true as const, trip };
}

export async function POST(request: NextRequest) {
  try {
    // ---- Rate limiting (abuse protection) ----
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    cleanupOldBuckets();

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { tripType, seatClass, adults, children } = body;
    const seatsNeeded = adults + children;

    if (tripType === "ROUND_TRIP") {
      const { outboundTripId, returnTripId } = body;

      if (!outboundTripId || !returnTripId) {
        return NextResponse.json(
          { error: "Both outbound and return trip ids are required" },
          { status: 400 }
        );
      }

      // Check seat availability on both legs before writing anything.
      const outboundCheck = await checkSeatAvailability(outboundTripId, seatClass, seatsNeeded);
      if (!outboundCheck.ok) {
        return NextResponse.json({ error: outboundCheck.error }, { status: outboundCheck.status });
      }

      const returnCheck = await checkSeatAvailability(returnTripId, seatClass, seatsNeeded);
      if (!returnCheck.ok) {
        return NextResponse.json({ error: returnCheck.error }, { status: returnCheck.status });
      }

      // Business rule: a return flight must depart after the outbound
      // flight arrives — otherwise we'd be selling a return before the
      // outbound even lands.
      if (returnCheck.trip.departureDateTime <= outboundCheck.trip.arrivalDateTime) {
        return NextResponse.json(
          { error: "The return flight must depart after the outbound flight arrives" },
          { status: 409 }
        );
      }

      const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

      // Create both legs atomically and link them together, so we never
      // end up with an orphaned outbound booking if the return leg fails.
      //
      // IMPORTANT: the return leg is created FIRST, with no link. The
      // outbound leg is created SECOND, holding linkedBookingId -> return.
      // This matters because every other part of the app (checkout,
      // invoice, passengers page, webhook) treats the OUTBOUND booking as
      // the primary one and reads its `linkedBooking` relation to find the
      // return leg. Since `linkedBookingId` is a one-directional pointer,
      // it must live on the outbound row, not the return row — otherwise
      // `outboundBooking.linkedBooking` resolves to null everywhere
      // downstream (this was a real bug, now fixed).
      const { outboundBooking, returnBooking } = await prisma.$transaction(async (tx) => {
        const returnBooking = await tx.booking.create({
          data: {
            tripId: returnTripId,
            tripType: "ROUND_TRIP",
            seatClass,
            seatsHeld: seatsNeeded,
            status: "PENDING",
            expiresAt,
          },
        });

        const outboundBooking = await tx.booking.create({
          data: {
            tripId: outboundTripId,
            tripType: "ROUND_TRIP",
            seatClass,
            seatsHeld: seatsNeeded,
            status: "PENDING",
            expiresAt,
            linkedBookingId: returnBooking.id,
          },
        });

        return { outboundBooking, returnBooking };
      });

      return NextResponse.json(
        { outboundBooking, returnBooking },
        { status: 201 }
      );
    }

    // ---- One-way (unchanged behavior) ----
    const { tripId } = body;

    const check = await checkSeatAvailability(tripId, seatClass, seatsNeeded);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

    const booking = await prisma.booking.create({
      data: {
        tripId,
        tripType: "ONE_WAY",
        seatClass,
        seatsHeld: seatsNeeded,
        status: "PENDING",
        expiresAt,
      },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "Error creating booking" },
      { status: 500 }
    );
  }
}