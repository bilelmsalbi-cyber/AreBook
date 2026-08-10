import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import TripsManager from "@/components/admin/TripsManager";
import { buildTripWhere, ADMIN_PAGE_SIZE } from "@/lib/adminFilters";

export default async function AdminTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; date?: string }>;
}) {
  const session = await adminAuth();
  const role = session?.user?.role ?? "EMPLOYEE";

  const { from, to, date } = await searchParams;
  const where = buildTripWhere({ from, to, date });

  const [trips, planes] = await Promise.all([
    prisma.trip.findMany({
      where,
      include: { plane: true },
      orderBy: { departureDateTime: "asc" },
      take: ADMIN_PAGE_SIZE + 1, // fetch one extra to detect "Load More"
    }),
    // Full unfiltered list — used only to populate the plane dropdown
    // in the Add/Edit form, unrelated to the paginated trips list.
    prisma.plane.findMany({
      orderBy: { id: "asc" },
    }),
  ]);

  const hasMore = trips.length > ADMIN_PAGE_SIZE;
  const pageTrips = trips.slice(0, ADMIN_PAGE_SIZE);

  const serializedTrips = pageTrips.map((trip) => ({
    ...trip,
    departureDateTime: trip.departureDateTime.toISOString(),
    arrivalDateTime: trip.arrivalDateTime.toISOString(),
    plane: {
      ...trip.plane,
      serviceStartDate: trip.plane.serviceStartDate.toISOString(),
      serviceEndDate: trip.plane.serviceEndDate
        ? trip.plane.serviceEndDate.toISOString()
        : null,
    },
  }));

  const serializedPlanes = planes.map((plane) => ({
    ...plane,
    serviceStartDate: plane.serviceStartDate.toISOString(),
    serviceEndDate: plane.serviceEndDate
      ? plane.serviceEndDate.toISOString()
      : null,
  }));

  return (
    <div className="p-8">
      <TripsManager
        initialTrips={serializedTrips}
        initialHasMore={hasMore}
        planes={serializedPlanes}
        role={role}
        initialSearch={{ from: from ?? "", to: to ?? "", date: date ?? "" }}
      />
    </div>
  );
}