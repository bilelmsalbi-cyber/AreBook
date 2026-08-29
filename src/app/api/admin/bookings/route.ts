import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import type { Prisma } from "@prisma/client";

const bookingInclude = {
  trip: {
    select: {
      id: true,
      departingPlace: true,
      destination: true,
      departureDateTime: true,
      arrivalDateTime: true,
      plane: { select: { aircraftType: true } },
    },
  },
  passengers: {
    select: {
      person: { select: { firstName: true, lastName: true } },
    },
  },
  payment: {
    select: { status: true, amount: true },
  },
  customer: {
    select: {
      id: true,
      person: { select: { firstName: true, lastName: true, email: true } },
    },
  },
  linkedBooking: {
    select: {
      id: true,
      pnr: true,
      payment: { select: { status: true, amount: true } },
    },
  },
} satisfies Prisma.BookingInclude;

export async function GET(request: NextRequest) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");
  const pnrParam = searchParams.get("pnr");
  const nameParam = searchParams.get("name");
  const statusParam = searchParams.get("status");
  const bookingStatusParam = searchParams.get("bookingStatus");
  const tripIdParam = searchParams.get("tripId");
  const dateParam = searchParams.get("date");

  const conditions: Prisma.BookingWhereInput[] = [];

  if (idParam) {
    const id = Number(idParam);
    if (!Number.isInteger(id)) {
      return NextResponse.json(
        { error: "Booking ID must be a number." },
        { status: 400 }
      );
    }
    conditions.push({ id });
  }

    if (pnrParam) {
    const pnr = pnrParam.trim();
    conditions.push({
      OR: [{ pnr }, { linkedBooking: { pnr } }, { linkedFromBooking: { pnr } }],
    });
  }

  if (nameParam) {
    const passengerNameFilter = {
      some: {
        person: {
          OR: [
            { firstName: { contains: nameParam, mode: "insensitive" as const } },
            { lastName: { contains: nameParam, mode: "insensitive" as const } },
          ],
        },
      },
    };
    conditions.push({
      OR: [
        { passengers: passengerNameFilter },
        { linkedBooking: { passengers: passengerNameFilter } },
      ],
    });
  }

  if (statusParam) {
    if (statusParam === "NOT_PAID") {
      conditions.push({
        payment: null,
        OR: [{ linkedBookingId: null }, { linkedBooking: { payment: null } }],
      });
    } else if (
      statusParam === "PENDING" ||
      statusParam === "PAID" ||
      statusParam === "FAILED" ||
      statusParam === "REFUNDED"
    ) {
      conditions.push({
        OR: [
          { payment: { status: statusParam } },
          { linkedBooking: { payment: { status: statusParam } } },
        ],
      });
    } else {
      return NextResponse.json(
        { error: "Invalid payment status." },
        { status: 400 }
      );
    }
  }

  if (bookingStatusParam) {
    if (
      bookingStatusParam !== "PENDING" &&
      bookingStatusParam !== "CONFIRMED" &&
      bookingStatusParam !== "CANCELLED"
    ) {
      return NextResponse.json(
        { error: "Invalid booking status." },
        { status: 400 }
      );
    }
    conditions.push({ status: bookingStatusParam });
  }

    if (tripIdParam) {
    const tripId = Number(tripIdParam);
    if (!Number.isInteger(tripId)) {
      return NextResponse.json(
        { error: "Trip ID must be a number." },
        { status: 400 }
      );
    }
    conditions.push({
      OR: [{ tripId }, { linkedBooking: { tripId } }, { linkedFromBooking: { tripId } }],
    });
  }

  if (dateParam) {
    const dayStart = new Date(`${dateParam}T00:00:00.000Z`);
    if (Number.isNaN(dayStart.getTime())) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    }
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    conditions.push({ bookingDate: { gte: dayStart, lt: dayEnd } });
  }

  if (conditions.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one search filter." },
      { status: 400 }
    );
  }
  const raw = await prisma.booking.findMany({
    where: { AND: conditions },
    include: bookingInclude,
    orderBy: { bookingDate: "desc" },
    take: 100,
  });

  const returnLegIds = new Set(
    raw.filter((b) => b.linkedBookingId !== null).map((b) => b.linkedBookingId as number)
  );

  const bookings = raw
    .filter((b) => !returnLegIds.has(b.id))
    .map((b) => {
      const returnLeg = raw.find((r) => r.id === b.linkedBookingId) ?? null;
      return {
        ...b,
        returnTrip: returnLeg ? returnLeg.trip : null,
      };
    });

  return NextResponse.json({ bookings });
}