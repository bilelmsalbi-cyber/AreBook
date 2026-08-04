import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [bookingsToday, activeTrips, monthlyPayments, recentBookings] =
    await Promise.all([
      prisma.booking.count({
        where: { bookingDate: { gte: startOfToday } },
      }),
      prisma.trip.count({
        where: { departureDateTime: { gte: now } },
      }),
      prisma.payment.findMany({
        where: {
          status: "PAID",
          paymentDate: { gte: startOfMonth },
        },
        select: { amount: true },
      }),
      prisma.booking.findMany({
        take: 5,
        orderBy: { bookingDate: "desc" },
        include: {
          trip: { select: { departingPlace: true, destination: true } },
        },
      }),
    ]);

  const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);

  const stats = [
    { label: "Bookings today", value: bookingsToday },
    { label: "Upcoming trips", value: activeTrips },
    { label: "Revenue this month", value: `${monthlyRevenue.toFixed(2)} TND` },
  ];

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-white">Overview</h1>
      <p className="mt-1 text-sm text-[#64748B]">
        Quick snapshot of current activity.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[#1E293B] bg-[#111827] p-5"
          >
            <p className="text-xs uppercase tracking-wider text-[#64748B]">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-white">Recent bookings</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-[#1E293B]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#111827] text-[#64748B]">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Route</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-[#64748B]"
                  >
                    No bookings yet.
                  </td>
                </tr>
              )}
              {recentBookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-t border-[#1E293B] text-[#CBD5E1]"
                >
                  <td className="px-4 py-3">#{booking.id}</td>
                  <td className="px-4 py-3">
                    {booking.trip.departingPlace} → {booking.trip.destination}
                  </td>
                  <td className="px-4 py-3">{booking.status}</td>
                  <td className="px-4 py-3">
                    {booking.bookingDate.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}