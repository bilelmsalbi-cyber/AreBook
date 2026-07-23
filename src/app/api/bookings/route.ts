// Goes in: D:\AreBook\src\app\api\bookings\route.ts
// (replaces the whole file)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, cleanupOldBuckets } from "@/lib/rateLimit";

const HOLD_MINUTES = 7;

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
    const { tripId, tripType, seatClass, adults, children } = body;

    const seatsNeeded = adults + children;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { plane: true },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const totalSeats =
      seatClass === "BUSINESS"
        ? trip.plane.nbrBusinessSeats
        : trip.plane.nbrGuestSeats;

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
      return NextResponse.json(
        { error: "Not enough seats available in this class" },
        { status: 409 }
      );
    }

    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

    const booking = await prisma.booking.create({
      data: {
        tripId,
        tripType,
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