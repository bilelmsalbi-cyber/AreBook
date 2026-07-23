// Goes in: D:\AreBook\src\app\api\flights\[id]\route.ts
// (replaces the whole file)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tripId = parseInt(id, 10);

    if (isNaN(tripId)) {
      return NextResponse.json({ error: "Invalid trip id" }, { status: 400 });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { plane: true },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Count seats taken per class: CONFIRMED bookings, or PENDING bookings
    // whose hold hasn't expired yet (same rule used when creating a booking)
    const activeBookings = await prisma.booking.findMany({
      where: {
        tripId,
        OR: [
          { status: "CONFIRMED" },
          { status: "PENDING", expiresAt: { gt: new Date() } },
        ],
      },
      select: { seatClass: true, seatsHeld: true },
    });

    const guestTaken = activeBookings
      .filter((b) => b.seatClass === "GUEST")
      .reduce((sum, b) => sum + b.seatsHeld, 0);

    const businessTaken = activeBookings
      .filter((b) => b.seatClass === "BUSINESS")
      .reduce((sum, b) => sum + b.seatsHeld, 0);

    const availableSeatsGuest = trip.plane.nbrGuestSeats - guestTaken;
    const availableSeatsBusiness = trip.plane.nbrBusinessSeats - businessTaken;

    return NextResponse.json({
      ...trip,
      availableSeatsGuest,
      availableSeatsBusiness,
    });
  } catch (error) {
    console.error("Error fetching trip:", error);
    return NextResponse.json(
      { error: "Error fetching trip" },
      { status: 500 }
    );
  }
}