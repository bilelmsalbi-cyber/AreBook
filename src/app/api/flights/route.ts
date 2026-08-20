import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FLIGHTS_PAGE_SIZE } from "@/lib/flightsPagination";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const departingPlace = searchParams.get("departingPlace");
    const destination = searchParams.get("destination");
    const departureDate = searchParams.get("departureDate");
    // Used for round-trip return-leg searches: excludes any trip that departs
    // at or before the outbound trip's arrival. This is a business rule, not
    // a search preference, so it applies even when the date filter is dropped
    // (e.g. "Show all flights").
    const afterDateTime = searchParams.get("afterDateTime");

    const skip = Math.max(0, parseInt(searchParams.get("skip") || "0", 10) || 0);
    const requestedTake = parseInt(searchParams.get("take") || "", 10);
    const take =
      requestedTake > 0 && requestedTake <= 50 ? requestedTake : FLIGHTS_PAGE_SIZE;

    const now = new Date();
    const departureDateTimeFilter: { gte?: Date; lt?: Date; gt?: Date } = {};

    // Lower bound: the later of "start of the requested day" and "right now".
    // This is what actually enforces "never show a flight that has already
    // departed" — it applies even when no date was picked at all.
    let lowerBound = now;
    if (departureDate) {
      const startOfDay = new Date(departureDate);
      if (startOfDay > lowerBound) {
        lowerBound = startOfDay;
      }
    }
    departureDateTimeFilter.gte = lowerBound;

    if (departureDate) {
      const endOfDay = new Date(departureDate);
      endOfDay.setDate(endOfDay.getDate() + 1);
      departureDateTimeFilter.lt = endOfDay;
    }

    if (afterDateTime) {
      const after = new Date(afterDateTime);
      if (!isNaN(after.getTime())) {
        departureDateTimeFilter.gt = after;
      }
    }

    const where = {
      ...(departingPlace && {
        departingPlace: {
          contains: departingPlace,
          mode: "insensitive" as const,
        },
      }),
      ...(destination && {
        destination: {
          contains: destination,
          mode: "insensitive" as const,
        },
      }),
      departureDateTime: departureDateTimeFilter,
    };

    const [trips, totalCount] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: { plane: true },
        orderBy: { departureDateTime: "asc" },
        skip,
        take,
      }),
      prisma.trip.count({ where }),
    ]);

    const hasMore = skip + trips.length < totalCount;

    return NextResponse.json({ trips, hasMore });
  } catch (error) {
    console.error("Error fetching flights:", error);
    return NextResponse.json(
      { error: "Error during flights retrieving" },
      { status: 500 }
    );
  }
}