import { redirect } from "next/navigation";
import { adminAuth, adminSignOut } from "@/lib/auth-admin";
import AdminSidebar from "@/components/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await adminAuth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const role = session.user.role;
  const name = session.user.name ?? "";

  const navItems = [
    { href: "/admin/dashboard", label: "Overview", icon: "📊" },
    { href: "/admin/trips", label: "Trips", icon: "✈️" },
    { href: "/admin/planes", label: "Fleet", icon: "🛩️" },
    { href: "/admin/bookings", label: "Bookings", icon: "🧾" },
    ...(role === "ADMIN"
      ? [{ href: "/admin/staff", label: "Staff Accounts", icon: "👥" }]
      : []),
  ];

  async function handleSignOut() {
    "use server";
    await adminSignOut({ redirectTo: "/admin/login" });
  }

  return (
    <div className="flex min-h-screen bg-[#0B0F19] text-white">
      <AdminSidebar
        navItems={navItems}
        name={name}
        role={role ?? ""}
        signOutAction={handleSignOut}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}