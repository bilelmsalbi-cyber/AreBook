import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import StaffManager from "@/components/admin/StaffManager";

export default async function AdminStaffPage() {
  const session = await adminAuth();

  // Staff management is restricted to ADMIN-level accounts only —
  // EMPLOYEE accounts never reach this page.
  if (session?.user?.role !== "ADMIN") {
    redirect("/admin/dashboard");
  }

  const staff = await prisma.admin.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      gender: true,
      dateBirth: true,
      salary: true,
      role: true,
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  const serializedStaff = staff.map((s) => ({
    ...s,
    dateBirth: s.dateBirth.toISOString(),
  }));

  return (
    <div className="p-8">
      <StaffManager
        initialStaff={serializedStaff}
        currentAdminId={Number(session.user.adminId)}
      />
    </div>
  );
}