import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import { requireAdminRole } from "@/lib/rbac";
import { buildPlaneWhere, ADMIN_PAGE_SIZE } from "@/lib/adminFilters";

// GET planes — read-only, available to both ADMIN and EMPLOYEE.
// Supports search (name/id) and pagination (skip/take), same pattern
// as the trips endpoint.
export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const where = buildPlaneWhere({
    name: searchParams.get("name") ?? undefined,
    id: searchParams.get("id") ?? undefined,
    showRetired: searchParams.get("showRetired") === "1",
  });
  const skip = Number(searchParams.get("skip") ?? 0);
  const take = Number(searchParams.get("take") ?? ADMIN_PAGE_SIZE);

  const planes = await prisma.plane.findMany({
    where,
    orderBy: { id: "asc" },
    skip,
    take: take + 1,
  });

  const hasMore = planes.length > take;
  const page = planes.slice(0, take);

  return NextResponse.json({ planes: page, hasMore });
}

// CREATE a new plane — Admin only
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
      aircraftType,
      nbrBusinessSeats,
      nbrGuestSeats,
      maxWeight,
      serviceStartDate,
    } = body;

    if (
      !aircraftType ||
      nbrBusinessSeats === undefined ||
      nbrGuestSeats === undefined ||
      !maxWeight ||
      !serviceStartDate
    ) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    const business = Number(nbrBusinessSeats);
    const guest = Number(nbrGuestSeats);
    const weight = Number(maxWeight);

    if (business < 0 || guest < 0) {
      return NextResponse.json(
        { error: "Seat counts cannot be negative." },
        { status: 400 }
      );
    }

    if (business + guest <= 0) {
      return NextResponse.json(
        { error: "Plane must have at least one seat." },
        { status: 400 }
      );
    }

    if (weight <= 0) {
      return NextResponse.json(
        { error: "Max weight must be greater than zero." },
        { status: 400 }
      );
    }

    const plane = await prisma.plane.create({
      data: {
        aircraftType,
        nbrBusinessSeats: business,
        nbrGuestSeats: guest,
        nbrSeats: business + guest,
        maxWeight: weight,
        serviceStartDate: new Date(serviceStartDate),
      },
    });

    return NextResponse.json({ success: true, plane });
  } catch (error) {
    console.error("Create plane error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}