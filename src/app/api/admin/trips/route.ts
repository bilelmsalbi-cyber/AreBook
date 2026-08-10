import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import { requireAdminRole } from "@/lib/rbac";
import { buildTripWhere, ADMIN_PAGE_SIZE } from "@/lib/adminFilters";

// GET trips — read-only, available to both ADMIN and EMPLOYEE.
// Supports search (from/to/date) and pagination (skip/take). Used by
// TripsManager's "Load More" button to fetch subsequent batches with
// the same filters as the current search.
export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const where = buildTripWhere({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    date: searchParams.get("date") ?? undefined,
  });
  const skip = Number(searchParams.get("skip") ?? 0);
  const take = Number(searchParams.get("take") ?? ADMIN_PAGE_SIZE);

  // Fetch one extra record to detect whether more results exist beyond
  // this batch, without a separate count() query.
  const trips = await prisma.trip.findMany({
    where,
    include: { plane: true },
    orderBy: { departureDateTime: "asc" },
    skip,
    take: take + 1,
  });

  const hasMore = trips.length > take;
  const page = trips.slice(0, take);

  return NextResponse.json({ trips: page, hasMore });
}

// CREATE a new trip — Admin only
export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forbidden = requireAdminRole(session.user.role);
  if (forbidden) return forbidden;

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