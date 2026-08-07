import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const bookingId = Number(id);

  if (!Number.isInteger(bookingId)) {
    return NextResponse.json({ error: "Invalid booking ID." }, { status: 400 });
  }

  const passengers = await prisma.passenger.findMany({
    where: { bookingId },
    select: {
      id: true,
      person: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          gender: true,
          dateBirth: true,
        },
      },
      document: {
        select: {
          documentType: true,
          number: true,
          country: true,
          expiryDate: true,
        },
      },
      specialRequests: {
        select: { id: true, requestType: true, price: true },
      },
    },
  });

  return NextResponse.json({ passengers });
}