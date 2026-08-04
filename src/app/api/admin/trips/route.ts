import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";

// GET all trips — used by the trips page, but we already fetch this
// server-side in page.tsx, so this endpoint is mainly for future use
// (e.g. client-side refresh after create/edit)
export async function GET() {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trips = await prisma.trip.findMany({
    include: { plane: true },
    orderBy: { departureDateTime: "asc" },
  });

  return NextResponse.json({ trips });
}

// CREATE a new trip
export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    if (
      !departureDateTime ||
      !arrivalDateTime ||
      !planId ||
      !priceBusiness ||
      !priceGuest ||
      !departingPlace ||
      !destination
    ) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

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

    // Seats always come from the plane's total capacity, never typed manually
    const plane = await prisma.plane.findUnique({
      where: { id: Number(planId) },
    });

    if (!plane) {
      return NextResponse.json(
        { error: "Selected plane does not exist." },
        { status: 400 }
      );
    }

    const trip = await prisma.trip.create({
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
    console.error("Create trip error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}