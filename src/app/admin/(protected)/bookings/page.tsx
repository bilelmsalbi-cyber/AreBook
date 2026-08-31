import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import BookingsManager from "@/components/admin/BookingsManager";

export default async function AdminBookingsPage() {
  const session = await adminAuth();
     if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EMPLOYEE")) {
     redirect("/admin/login");
   }

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
         <BookingsManager tripOptions={tripOptions} role={session.user.role} />
    </div>
  );
}