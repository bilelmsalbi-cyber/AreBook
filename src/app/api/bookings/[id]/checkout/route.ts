import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { priceService, RawService } from "@/lib/pricing/engine";
import { calculateRoundTripPrice } from "@/lib/pricing/engine";
type IncomingPassenger = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: "Mr" | "Mme";
  dateBirth: string;
  hasDocument: boolean;
  documentType: string;
  documentNumber: string;
  documentCountry: string;
  documentExpiry: string;
  services: RawService[];
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookingId = parseInt(id, 10);

    if (isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }

    const body = await request.json();
    const passengers: IncomingPassenger[] = body.passengers;

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return NextResponse.json({ error: "No passenger data provided" }, { status: 400 });
    }

    // ---- Validate required fields for every passenger ----
    for (const p of passengers) {
      if (!p.firstName || !p.lastName || !p.email || !p.phone || !p.dateBirth) {
        return NextResponse.json(
          { error: "Missing required passenger information" },
          { status: 400 }
        );
      }
      if (p.hasDocument && (!p.documentNumber || !p.documentCountry || !p.documentExpiry)) {
        return NextResponse.json(
          { error: "Incomplete passport details" },
          { status: 400 }
        );
      }
    }

    // Passengers are entered once per round-trip pair, always on the
    // outbound (primary) booking. linkedBooking is included so its fare
    // can be folded into the discount calculation, and so it also gets
    // its own Passenger records (see below).
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: true,
        linkedBooking: { include: { trip: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "CONFIRMED") {
     return NextResponse.json(
     { error: "This booking has already been paid and cannot be modified" },
     { status: 409 }
     );
    }

    if (booking.status !== "PENDING") {
      return NextResponse.json(
        { error: "This booking is no longer pending" },
        { status: 409 }
      );
    }

    if (booking.expiresAt && booking.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This booking hold has expired" },
        { status: 410 }
      );
    }

    // A round trip means two Booking rows (outbound + linked return).
    // Each Passenger row requires its own unique Person (personId is @unique),
    // so the same traveler needs one Person+Passenger pair per leg — created
    // from the same submitted form data, not entered twice by the user.
    const bookingIdsToPopulate = booking.linkedBookingId
      ? [bookingId, booking.linkedBookingId]
      : [bookingId];

    // Everything below runs as ONE atomic transaction:
    // either all writes succeed, or none of them do.
    const result = await prisma.$transaction(async (tx) => {
      // ---- Clean up any previous passengers for this booking (and its
      // linked leg, if any) ----
      // (handles the case where the user goes back and edits their info)
      const oldPassengers = await tx.passenger.findMany({
        where: { bookingId: { in: bookingIdsToPopulate } },
        select: { id: true, personId: true, docId: true },
      });

      const oldPassengerIds = oldPassengers.map((p) => p.id);
      const oldPersonIds = oldPassengers.map((p) => p.personId);
      const oldDocIds = oldPassengers
        .map((p) => p.docId)
        .filter((docId): docId is number => docId !== null);

      if (oldPassengerIds.length > 0) {
        await tx.specialRequest.deleteMany({
          where: { passengerId: { in: oldPassengerIds } },
        });
        await tx.passenger.deleteMany({ where: { id: { in: oldPassengerIds } } });
      }
      if (oldDocIds.length > 0) {
        await tx.document.deleteMany({ where: { id: { in: oldDocIds } } });
      }
      if (oldPersonIds.length > 0) {
        await tx.person.deleteMany({ where: { id: { in: oldPersonIds } } });
      }

      // ---- Rebuild fresh passengers from the submitted form data ----
      // For a round trip, each traveler gets one Passenger row per leg
      // (separate Person rows, since personId is unique).
      let specialRequestsTotal = 0;

      for (const p of passengers) {
        for (const legBookingId of bookingIdsToPopulate) {
          const person = await tx.person.create({
            data: {
              firstName: p.firstName,
              lastName: p.lastName,
              email: p.email,
              phone: p.phone,
              gender: p.gender,
              dateBirth: new Date(p.dateBirth),
            },
          });

          let documentId: number | null = null;
          if (p.hasDocument) {
            const doc = await tx.document.create({
              data: {
                documentType: p.documentType,
                number: p.documentNumber,
                country: p.documentCountry,
                expiryDate: new Date(p.documentExpiry),
              },
            });
            documentId = doc.id;
          }

          const passenger = await tx.passenger.create({
            data: {
              personId: person.id,
              bookingId: legBookingId,
              docId: documentId,
            },
          });

          // Recompute every service price server-side (never trust client price).
          // The traveler picks each service once, but it's applied to both legs
          // of a round trip (airport-standard behavior) — so it's created once
          // per Passenger row (one per leg), and its price is added to the total
          // each time, doubling it for round trips.
          for (const service of p.services) {
            const { label, price } = await priceService(service);
            specialRequestsTotal += price;

            await tx.specialRequest.create({
              data: {
                passengerId: passenger.id,
                requestType: label,
                price,
              },
            });
          }
        }
      }

      // ---- Compute the fare ----
      // One-way: just this leg's fare.
      // Round-trip: combine both legs' fares through the discount tiers
      // in lib/pricing.ts — never a plain sum.
      const outboundFarePerSeat =
        booking.seatClass === "BUSINESS"
          ? booking.trip.priceBusiness
          : booking.trip.priceGuest;
      const outboundFare = outboundFarePerSeat * booking.seatsHeld;

      let fare = outboundFare;

      if (booking.linkedBooking) {
        const returnFarePerSeat =
          booking.linkedBooking.seatClass === "BUSINESS"
            ? booking.linkedBooking.trip.priceBusiness
            : booking.linkedBooking.trip.priceGuest;
        const returnFare = returnFarePerSeat * booking.linkedBooking.seatsHeld;

        fare = await calculateRoundTripPrice(outboundFare, returnFare);
      }

      const totalAmount = fare + specialRequestsTotal;

      // ---- Create or update the single Payment for this booking (pair) ----
      // Payment no longer points at a Booking — Booking points at Payment
      // (`Booking.paymentId`), so the same Payment row can be shared by
      // both legs of a round trip.
      const payment = booking.paymentId
        ? await tx.payment.update({
            where: { id: booking.paymentId },
            data: { amount: totalAmount, status: "PENDING" },
          })
        : await tx.payment.create({
            data: { amount: totalAmount, status: "PENDING" },
          });

      // Point this booking — and its linked leg, if any — at the Payment.
      // Safe to re-run: both writes are idempotent.
      await tx.booking.update({
        where: { id: bookingId },
        data: { paymentId: payment.id },
      });

      if (booking.linkedBookingId) {
        await tx.booking.update({
          where: { id: booking.linkedBookingId },
          data: { paymentId: payment.id },
        });
      }

      return { totalAmount, payment };
    });

    return NextResponse.json({
      bookingId,
      totalAmount: result.totalAmount,
      paymentStatus: result.payment.status,
    });
  } catch (error) {
    console.error("Error during checkout:", error);
    return NextResponse.json(
      { error: "Error preparing the invoice" },
      { status: 500 }
    );
  }
}