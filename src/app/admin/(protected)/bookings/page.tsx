import { prisma } from "@/lib/prisma";
import BookingsManager from "@/components/admin/BookingsManager";

export default async function AdminBookingsPage() {
  // Fetched here (not via API) purely to populate the "Trip" search tab's
  // dropdown — same pattern as the plane dropdown on the Trips page.
  const trips = await prisma.trip.findMany({
    orderBy: { departureDateTime: "asc" },
    select: {
      id: true,
      departingPlace: true,
      destination: true,
      departureDateTime: true,
      plane: { select: { aircraftType: true } },
    },
  });

  const tripOptions = trips.map((trip) => ({
    id: trip.id,
    departingPlace: trip.departingPlace,
    destination: trip.destination,
    departureDateTime: trip.departureDateTime.toISOString(),
    aircraftType: trip.plane.aircraftType,
  }));

  return (
    <div className="p-8">
      <BookingsManager tripOptions={tripOptions} />
    </div>
  );
}