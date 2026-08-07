import { prisma } from "@/lib/prisma";
import TripsManager from "@/components/admin/TripsManager";

export default async function AdminTripsPage() {
  const [trips, planes] = await Promise.all([
    prisma.trip.findMany({
      include: { plane: true },
      orderBy: { departureDateTime: "asc" },
    }),
    prisma.plane.findMany({
      orderBy: { id: "asc" },
    }),
  ]);

  // Serialize dates to strings so we can pass this data to a Client Component
  const serializedTrips = trips.map((trip) => ({
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
      <TripsManager initialTrips={serializedTrips} planes={serializedPlanes} />
    </div>
  );
}