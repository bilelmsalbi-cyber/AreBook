import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// ---------------------------------------------------------------------
// GET /api/bookings/[id]
//
// Two ways to be allowed to view this booking:
//   - Logged in: session's customerId matches the booking's customerId
//     (used by "My Bookings" / Show Passengers Info after the fact).
//   - accessToken query param matches the booking's accessToken (used
//     during the live booking flow — /passengers, /invoice — before any
//     login or pnr exists yet; see accessToken generation in
//     api/bookings/route.ts POST).
//
// No credentials at all -> 401. Credentials present but wrong -> 403.
// ---------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookingId = parseInt(id, 10);

    if (isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }

    const token = request.nextUrl.searchParams.get("token");

    const session = await auth();
    const customerId = session?.user?.customerId
      ? parseInt(session.user.customerId, 10)
      : null;

    if (!customerId && !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: { include: { plane: true } },
        passengers: {
          include: {
            person: true,
            document: true,
            specialRequests: true,
          },
        },
        payment: true,
        // Additive: lets consumers (like the invoice) compute an accurate
        // services total across both legs, not just the outbound one.
        linkedBooking: {
          include: {
            trip: { include: { plane: true } },
            passengers: {
              include: {
                person: true,
                document: true,
                specialRequests: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const authorizedViaSession = customerId !== null && booking.customerId === customerId;
    const authorizedViaToken =
      !!token && !!booking.accessToken && token === booking.accessToken;

    if (!authorizedViaSession && !authorizedViaToken) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json(
      { error: "Error fetching booking" },
      { status: 500 }
    );
  }
}