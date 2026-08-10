import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import PlanesManager from "@/components/admin/PlanesManager";
import { buildPlaneWhere, ADMIN_PAGE_SIZE } from "@/lib/adminFilters";

export default async function AdminPlanesPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; id?: string; showRetired?: string }>;
}) {
  const session = await adminAuth();
  const role = session?.user?.role ?? "EMPLOYEE";

  const { name, id, showRetired } = await searchParams;
  const where = buildPlaneWhere({
    name,
    id,
    showRetired: showRetired === "1",
  });

  const planes = await prisma.plane.findMany({
    where,
    orderBy: { id: "asc" },
    take: ADMIN_PAGE_SIZE + 1,
  });

  const hasMore = planes.length > ADMIN_PAGE_SIZE;
  const pagePlanes = planes.slice(0, ADMIN_PAGE_SIZE);

  const serializedPlanes = pagePlanes.map((plane) => ({
    ...plane,
    serviceStartDate: plane.serviceStartDate.toISOString(),
    serviceEndDate: plane.serviceEndDate
      ? plane.serviceEndDate.toISOString()
      : null,
  }));

  return (
    <div className="p-8">
      <PlanesManager
        initialPlanes={serializedPlanes}
        initialHasMore={hasMore}
        role={role}
        initialSearch={{
          name: name ?? "",
          id: id ?? "",
          showRetired: showRetired === "1",
        }}
      />
    </div>
  );
}