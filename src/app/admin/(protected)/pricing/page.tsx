import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import PricingManager from "@/components/admin/PricingManager";

export default async function AdminPricingPage() {
  const session = await adminAuth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const [services, discountTiers, cancellationTiers, employeeCancellationLimit] =
    await Promise.all([
      prisma.servicePrice.findMany({ orderBy: { serviceType: "asc" } }),
      prisma.roundTripDiscountTier.findMany({ orderBy: { minTotal: "asc" } }),
      prisma.cancellationTier.findMany({ orderBy: { minHoursBefore: "asc" } }),
      prisma.employeeCancellationLimit.findFirst(),
    ]);

  return (
    <div className="p-8">
      <PricingManager
        role={session.user.role ?? ""}
        initialServices={services.map((s) => ({
          ...s,
          updatedAt: s.updatedAt.toISOString(),
        }))}
        initialDiscountTiers={discountTiers.map((t) => ({
          ...t,
          updatedAt: t.updatedAt.toISOString(),
        }))}
        initialCancellationTiers={cancellationTiers.map((t) => ({
          ...t,
          updatedAt: t.updatedAt.toISOString(),
        }))}
        initialEmployeeCancellationLimit={
          employeeCancellationLimit
            ? {
                ...employeeCancellationLimit,
                updatedAt: employeeCancellationLimit.updatedAt.toISOString(),
              }
            : null
        }
      />
    </div>
  );
}