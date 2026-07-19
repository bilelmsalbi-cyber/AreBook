import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const departingPlace = searchParams.get("departingPlace");
    const destination = searchParams.get("destination");
    const departureDate = searchParams.get("departureDate");

    // Build a full-day range filter since departureDateTime includes time,
    // but the user only picks a date (no time)
    let dateFilter = {};
    if (departureDate) {
      const startOfDay = new Date(departureDate);
      const endOfDay = new Date(departureDate);
      endOfDay.setDate(endOfDay.getDate() + 1);

      dateFilter = {
        departureDateTime: {
          gte: startOfDay,
          lt: endOfDay,
        },
      };
    }

    const trips = await prisma.trip.findMany({
      where: {
        ...(departingPlace && {
          departingPlace: {
            contains: departingPlace,
            mode: "insensitive",
          },
        }),
        ...(destination && {
          destination: {
            contains: destination,
            mode: "insensitive",
          },
        }),
        ...dateFilter,
      },
      include: {
        plane: true,
      },
      orderBy: {
        departureDateTime: "asc",
      },
      take: 50,
    });

    return NextResponse.json(trips);
  } catch (error) {
    console.error("Error fetching flights:", error);
    return NextResponse.json(
      { error: "Error during flights retrieving" },
      { status: 500 }
    );
  }
}