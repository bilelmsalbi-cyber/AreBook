import type { Prisma } from "@prisma/client";

// Shared filter-building logic for Trips and Planes admin search.
// Used by both the server-rendered page (first batch) and the GET API
// route (subsequent "Load More" batches) so the two never drift apart —
// single source of truth for how search params translate into a Prisma
// `where` clause (see project principle: no duplicated business logic).

export const ADMIN_PAGE_SIZE = 20;

export type TripSearchParams = {
  from?: string;
  to?: string;
  date?: string;
};

export function buildTripWhere(
  params: TripSearchParams
): Prisma.TripWhereInput {
  const where: Prisma.TripWhereInput = {};

  // Route filter only applies when BOTH from and to are provided.
  // A single filled field alone is intentionally ignored — the UI
  // blocks submitting just one of the two (see TripsManager).
  if (params.from && params.to) {
    where.departingPlace = { contains: params.from, mode: "insensitive" };
    where.destination = { contains: params.to, mode: "insensitive" };
  }

  if (params.date) {
    const day = new Date(params.date);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    where.departureDateTime = { gte: day, lt: nextDay };
  }

  return where;
}

export type PlaneSearchParams = {
  name?: string;
  id?: string;
  showRetired?: boolean;
};

export function buildPlaneWhere(
  params: PlaneSearchParams
): Prisma.PlaneWhereInput {
  const where: Prisma.PlaneWhereInput = {};

  if (params.name) {
    where.aircraftType = { contains: params.name, mode: "insensitive" };
  }

  if (params.id) {
    const idNum = Number(params.id);
    if (!Number.isNaN(idNum)) {
      where.id = idNum;
    }
  }

  // Hidden by default — an explicit "Show retired planes" checkbox
  // opts back in (see PlanesManager).
  if (!params.showRetired) {
    where.serviceEndDate = null;
  }

  return where;
}