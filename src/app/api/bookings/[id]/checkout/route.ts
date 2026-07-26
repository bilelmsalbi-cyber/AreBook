// Goes in: D:\AreBook\src\app\api\bookings\[id]\checkout\route.ts
// (replaces the whole file)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { priceService, RawService } from "@/lib/servicePricing";

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

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { trip: true },
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

    // Everything below runs as ONE atomic transaction:
    // either all writes succeed, or none of them do.
    const result = await prisma.$transaction(async (tx) => {
      // ---- Clean up any previous passengers for this booking ----
      // (handles the case where the user goes back and edits their info)
      const oldPassengers = await tx.passenger.findMany({
        where: { bookingId },
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
      let specialRequestsTotal = 0;

      for (const p of passengers) {
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
            bookingId,
            docId: documentId,
          },
        });

        // Recompute every service price server-side (never trust client price)
        for (const service of p.services) {
          const { label, price } = priceService(service);
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

      // ---- Compute the fare and create the Payment row (still unpaid) ----
      const farePerSeat =
        booking.seatClass === "BUSINESS"
          ? booking.trip.priceBusiness
          : booking.trip.priceGuest;

      const totalAmount = farePerSeat * booking.seatsHeld + specialRequestsTotal;

      const payment = await tx.payment.upsert({
        where: { bookingId },
        create: {
          bookingId,
          amount: totalAmount,
          status: "PENDING", // not paid yet
        },
        update: {
          amount: totalAmount,
          status: "PENDING",
        },
      });

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