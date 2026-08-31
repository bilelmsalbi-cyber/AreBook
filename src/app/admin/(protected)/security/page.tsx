import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import PasskeyManager from "@/components/admin/PasskeyManager";

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const session = await adminAuth();
  if (!session?.user?.adminId) {
    redirect("/admin/login");
  }

  const { required } = await searchParams;
  const adminId = Number(session.user.adminId);

  const passkeys = await prisma.adminPasskey.findMany({
    where: { adminId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      deviceLabel: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  const serializedPasskeys = passkeys.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
  }));

  return (
    <div className="p-8">
      <PasskeyManager
        initialPasskeys={serializedPasskeys}
        required={required === "1"}
      />
    </div>
  );
}