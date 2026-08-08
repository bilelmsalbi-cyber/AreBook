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
} satisfies Prisma.BookingInclude;

// All filters below are optional and combine with AND — supplying more
// than one (e.g. tripId + date) narrows the result further. Adding a new
// filter in the future only requires one more block pushed to `conditions`.
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
    // PNR is unique per booking — exact match, not a partial search.
    conditions.push({ pnr: pnrParam.trim() });
  }

  if (nameParam) {
    // Matches if the term appears in the first or last name of ANY
    // passenger on the booking (a booking can carry several).
    conditions.push({
      passengers: {
        some: {
          person: {
            OR: [
              { firstName: { contains: nameParam, mode: "insensitive" } },
              { lastName: { contains: nameParam, mode: "insensitive" } },
            ],
          },
        },
      },
    });
  }

  if (statusParam) {
    // "NOT_PAID" is a UI-only pseudo-status meaning the booking has no
    // Payment record yet (the relation is optional in the schema).
    if (statusParam === "NOT_PAID") {
      conditions.push({ payment: null });
    } else if (
      statusParam === "PENDING" ||
      statusParam === "PAID" ||
      statusParam === "FAILED"
    ) {
      conditions.push({ payment: { status: statusParam } });
    } else {
      return NextResponse.json(
        { error: "Invalid payment status." },
        { status: 400 }
      );
    }
  }

  if (tripIdParam) {
    const tripId = Number(tripIdParam);
    if (!Number.isInteger(tripId)) {
      return NextResponse.json(
        { error: "Trip ID must be a number." },
        { status: 400 }
      );
    }
    conditions.push({ tripId });
  }

  if (dateParam) {
    // `dateParam` is YYYY-MM-DD. Matches any booking made on that
    // calendar day in UTC, regardless of the exact time.
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

  const bookings = await prisma.booking.findMany({
    where: { AND: conditions },
    include: bookingInclude,
    orderBy: { bookingDate: "desc" },
    take: 100, // safety cap — searches are expected to be narrow
  });

  return NextResponse.json({ bookings });
}