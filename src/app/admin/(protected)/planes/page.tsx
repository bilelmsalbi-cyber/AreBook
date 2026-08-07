import { prisma } from "@/lib/prisma";
import PlanesManager from "@/components/admin/PlanesManager";

export default async function AdminPlanesPage() {
  const planes = await prisma.plane.findMany({
    orderBy: { id: "asc" },
  });

  const serializedPlanes = planes.map((plane) => ({
    ...plane,
    serviceStartDate: plane.serviceStartDate.toISOString(),
    serviceEndDate: plane.serviceEndDate
      ? plane.serviceEndDate.toISOString()
      : null,
  }));

  return (
    <div className="p-8">
      <PlanesManager initialPlanes={serializedPlanes} />
    </div>
  );
}