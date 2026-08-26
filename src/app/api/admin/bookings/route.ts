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
  // The account this booking is linked to, if any — assigned at
  // creation time (see lib/cancellation.ts note on customerId), so the
  // outbound row already carries its own customer directly, no
  // fallback through linkedBooking needed.
  customer: {
    select: {
      id: true,
      person: { select: { firstName: true, lastName: true, email: true } },
    },
  },
  // Round-trip: the return leg carries neither its own pnr nor its own
  // Payment — both resolve back through this relation.
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
  const statusParam = searchParams.get("status"); // payment status
  const bookingStatusParam = searchParams.get("bookingStatus"); // booking status
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
    // A round-trip return leg has no pnr of its own — it shares its
    // linked (outbound) booking's pnr. Match either.
    const pnr = pnrParam.trim();
    conditions.push({
      OR: [{ pnr }, { linkedBooking: { pnr } }],
    });
  }

  if (nameParam) {
    // Passenger details are entered once per round-trip pair, on the
    // payment-holding booking — check both this booking and its linked
    // leg so a search still finds the pair either way.
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
    // "NOT_PAID" is a UI-only pseudo-status meaning neither this booking
    // nor its linked leg has a Payment yet.
    if (statusParam === "NOT_PAID") {
      conditions.push({
        payment: null,
        OR: [{ linkedBookingId: null }, { linkedBooking: { payment: null } }],
      });
    } else if (
      statusParam === "PENDING" ||
      statusParam === "PAID" ||
      statusParam === "FAILED"
    ) {
      // A round-trip return leg has no Payment of its own — its status
      // is whatever its linked (outbound) leg's Payment says.
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
    // Booking.status (PENDING/CONFIRMED/CANCELLED) — distinct from the
    // payment-status filter above. Both legs of a round-trip pair are
    // always set together (see executeCancellation in
    // lib/cancellation.ts), so filtering on the outbound row's own
    // status is authoritative — no linkedBooking fallback needed here,
    // unlike pnr/payment.
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
    conditions.push({ tripId });
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

  // Round-trip: the OUTBOUND leg carries `linkedBookingId` pointing at
  // the return leg — the return leg never points back. So a booking is
  // a "return leg" if and only if some other booking in this result set
  // has a linkedBookingId equal to its id. Those rows are dropped, and
  // their trip is merged onto the outbound row as `returnTrip` — so the
  // admin sees one line per round-trip booking instead of two, with the
  // outbound row (holding the real pnr/payment/customer) as the primary
  // line. If only one leg matched the filters (e.g. searching by the
  // return trip's id), it's shown standalone as before; its pnr/payment
  // already fall back through `linkedBooking` (see paymentLabel/pnrLabel
  // in BookingsManager).
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