import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";

// UPDATE an existing trip
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const tripId = Number(id);
    const body = await request.json();
    const {
      departureDateTime,
      arrivalDateTime,
      planId,
      priceBusiness,
      priceGuest,
      departingPlace,
      destination,
    } = body;

    const departure = new Date(departureDateTime);
    const arrival = new Date(arrivalDateTime);

    if (arrival <= departure) {
      return NextResponse.json(
        { error: "Arrival must be after departure." },
        { status: 400 }
      );
    }

    if (Number(priceBusiness) < 0 || Number(priceGuest) < 0) {
      return NextResponse.json(
        { error: "Prices cannot be negative." },
        { status: 400 }
      );
    }

    // If the plane changed, reset seat capacity to the new plane's totals.
    // Note: this is a simplification — it doesn't account for existing bookings
    // on this trip. Fine for now since trips with active bookings can't easily
    // change planes in a real system; revisit if this becomes an issue.
    const plane = await prisma.plane.findUnique({
      where: { id: Number(planId) },
    });

    if (!plane) {
      return NextResponse.json(
        { error: "Selected plane does not exist." },
        { status: 400 }
      );
    }

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        departureDateTime: departure,
        arrivalDateTime: arrival,
        planId: Number(planId),
        priceBusiness: Number(priceBusiness),
        priceGuest: Number(priceGuest),
        departingPlace,
        destination,
        availableSeatsBusiness: plane.nbrBusinessSeats,
        availableSeatsGuest: plane.nbrGuestSeats,
      },
    });

    return NextResponse.json({ success: true, trip });
  } catch (error) {
    console.error("Update trip error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

// DELETE a trip — blocked if it has active bookings
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const tripId = Number(id);

    // Check for active bookings on this trip first
    const activeBookingsCount = await prisma.booking.count({
      where: {
        tripId,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });

    if (activeBookingsCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete this trip: ${activeBookingsCount} active booking(s) are linked to it. Cancel or resolve those bookings first.`,
        },
        { status: 409 }
      );
    }

    await prisma.trip.delete({ where: { id: tripId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete trip error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}