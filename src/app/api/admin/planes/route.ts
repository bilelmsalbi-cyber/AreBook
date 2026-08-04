import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const planes = await prisma.plane.findMany({
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ planes });
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      aircraftType,
      nbrBusinessSeats,
      nbrGuestSeats,
      maxWeight,
      serviceStartDate,
    } = body;

    if (
      !aircraftType ||
      nbrBusinessSeats === undefined ||
      nbrGuestSeats === undefined ||
      !maxWeight ||
      !serviceStartDate
    ) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    const business = Number(nbrBusinessSeats);
    const guest = Number(nbrGuestSeats);
    const weight = Number(maxWeight);

    if (business < 0 || guest < 0) {
      return NextResponse.json(
        { error: "Seat counts cannot be negative." },
        { status: 400 }
      );
    }

    if (business + guest <= 0) {
      return NextResponse.json(
        { error: "Plane must have at least one seat." },
        { status: 400 }
      );
    }

    if (weight <= 0) {
      return NextResponse.json(
        { error: "Max weight must be greater than zero." },
        { status: 400 }
      );
    }

    const plane = await prisma.plane.create({
      data: {
        aircraftType,
        nbrBusinessSeats: business,
        nbrGuestSeats: guest,
        nbrSeats: business + guest,
        maxWeight: weight,
        serviceStartDate: new Date(serviceStartDate),
      },
    });

    return NextResponse.json({ success: true, plane });
  } catch (error) {
    console.error("Create plane error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}