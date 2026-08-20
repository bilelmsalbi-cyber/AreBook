"use client";

import { useState } from "react";
import type { BookingResult, TripOption } from "@/types/booking";
import PassengersModal from "@/components/admin/bookings/PassengersModal";

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "Any" },
  { value: "NOT_PAID", label: "Not paid yet" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
}

function passengerNames(booking: BookingResult) {
  if (booking.passengers.length === 0) return "—";
  return booking.passengers
    .map((p) => `${p.person.firstName} ${p.person.lastName}`)
    .join(", ");
}

// A round-trip return leg has no Payment/pnr of its own — both resolve
// back through linkedBooking. See api/admin/bookings/route.ts.
function paymentLabel(booking: BookingResult) {
  const effectivePayment = booking.payment ?? booking.linkedBooking?.payment ?? null;
  if (!effectivePayment) return "Not paid yet";
  if (effectivePayment.status === "PAID") return "Paid";
  if (effectivePayment.status === "FAILED") return "Failed";
  return "Pending";
}

function pnrLabel(booking: BookingResult) {
  return booking.pnr || booking.linkedBooking?.pnr || "—";
}

// Round-trip: only the outbound leg's Payment holds the amount (covers
// both legs). See api/admin/bookings/route.ts.
function priceLabel(booking: BookingResult) {
  const effectivePayment = booking.payment ?? booking.linkedBooking?.payment ?? null;
  if (!effectivePayment) return "—";
  return `$${effectivePayment.amount.toFixed(2)}`;
}

// A booking is "past" only when every leg it includes has already
// departed. One-way: just the outbound leg. Round-trip: both outbound
// and return must be in the past — if the return leg is still upcoming,
// the booking as a whole is still upcoming.
function isPastBooking(booking: BookingResult) {
  const now = Date.now();
  const outboundPast = new Date(booking.trip.departureDateTime).getTime() < now;
  if (!booking.returnTrip) return outboundPast;
  const returnPast = new Date(booking.returnTrip.departureDateTime).getTime() < now;
  return outboundPast && returnPast;
}

const emptyFilters = {
  id: "",
  pnr: "",
  name: "",
  status: "",
  tripId: "",
  date: "",
};

export default function BookingsManager({
  tripOptions,
}: {
  tripOptions: TripOption[];
}) {
  const [filters, setFilters] = useState(emptyFilters);
  const [results, setResults] = useState<BookingResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excludePast, setExcludePast] = useState(true);
  const [viewingBookingId, setViewingBookingId] = useState<number | null>(
    null
  );

  function updateFilter(field: keyof typeof emptyFilters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    const params = new URLSearchParams();
    if (filters.id.trim()) params.set("id", filters.id.trim());
    if (filters.pnr.trim()) params.set("pnr", filters.pnr.trim());
    if (filters.name.trim()) params.set("name", filters.name.trim());
    if (filters.status) params.set("status", filters.status);
    if (filters.tripId) params.set("tripId", filters.tripId);
    if (filters.date) params.set("date", filters.date);

    if ([...params.keys()].length === 0) {
      setError("Enter at least one filter to search.");
      return;
    }

    setError(null);
    setLoading(true);
    setHasSearched(true);

    const res = await fetch(`/api/admin/bookings?${params.toString()}`);
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      setResults([]);
      return;
    }

    setResults(data.bookings);
  }

  function handleClear() {
    setFilters(emptyFilters);
    setResults([]);
    setHasSearched(false);
    setError(null);
    setExcludePast(true);
  }

  const visibleResults = excludePast
    ? results.filter((b) => !isPastBooking(b))
    : results;

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-white">Bookings</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Combine any of the filters below to search bookings.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-[#1E293B] bg-[#111827] p-4 md:grid-cols-6"
      >
        <div>
          <label className="mb-1 block text-xs text-[#64748B]">
            Booking ID
          </label>
          <input
            type="number"
            min="1"
            value={filters.id}
            onChange={(e) => updateFilter("id", e.target.value)}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#64748B]">PNR</label>
          <input
            type="text"
            placeholder="e.g. AB12CD"
            value={filters.pnr}
            onChange={(e) => updateFilter("pnr", e.target.value)}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#64748B]">
            Passenger Name
          </label>
          <input
            type="text"
            placeholder="e.g. Sarah"
            value={filters.name}
            onChange={(e) => updateFilter("name", e.target.value)}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#64748B]">
            Payment Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
          >
            {PAYMENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#64748B]">Trip</label>
          <select
            value={filters.tripId}
            onChange={(e) => updateFilter("tripId", e.target.value)}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
          >
            <option value="">Any</option>
            {tripOptions.map((trip) => (
              <option key={trip.id} value={trip.id}>
                #{trip.id} — {trip.departingPlace} → {trip.destination}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#64748B]">
            Booking Date
          </label>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => updateFilter("date", e.target.value)}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
          />
        </div>

        <div className="col-span-2 flex items-end gap-4 md:col-span-6">
          <label className="flex items-center gap-1.5 text-sm text-[#94A3B8]">
            <input
              type="radio"
              checked={excludePast}
              onClick={() => setExcludePast((prev) => !prev)}
              onChange={() => {}}
              className="h-4 w-4 accent-[#3B82F6]"
            />
            Exclude past bookings
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#3B82F6] px-5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#2563EB] disabled:opacity-60"
          >
            {loading ? "Searching..." : "Search"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
          >
            Clear
          </button>
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-xl border border-[#1E293B]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#111827] text-[#64748B]">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">PNR</th>
              <th className="px-4 py-3 font-medium">Passenger(s)</th>
              <th className="px-4 py-3 font-medium">Trip</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Booking Status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Booked On</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {!hasSearched && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-[#64748B]">
                  Enter at least one filter and search.
                </td>
              </tr>
            )}
            {hasSearched && !loading && visibleResults.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-[#64748B]">
                  No bookings match this search.
                </td>
              </tr>
            )}
            {visibleResults.map((booking) => (
              <tr
                key={booking.id}
                className="border-t border-[#1E293B] text-[#CBD5E1]"
              >
                <td className="px-4 py-3">#{booking.id}</td>
                <td className="px-4 py-3">{pnrLabel(booking)}</td>
                <td className="px-4 py-3">{passengerNames(booking)}</td>
                <td className="px-4 py-3">
                  <div>
                    {booking.trip.departingPlace} → {booking.trip.destination}
                  </div>
                  {booking.returnTrip && (
                    <div className="mt-0.5 text-[#3B82F6]">
                      ↩ {booking.returnTrip.departingPlace} → {booking.returnTrip.destination}
                    </div>
                  )}
                  <div className="text-xs text-[#64748B]">
                    {booking.trip.plane.aircraftType}
                  </div>
                </td>
                <td className="px-4 py-3">{booking.seatClass}</td>
                <td className="px-4 py-3">{booking.status}</td>
                <td className="px-4 py-3">{paymentLabel(booking)}</td>
                <td className="px-4 py-3">{priceLabel(booking)}</td>
                <td className="px-4 py-3">
                  {formatDateTime(booking.bookingDate)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setViewingBookingId(booking.id)}
                    className="text-xs font-semibold text-[#3B82F6] hover:underline"
                  >
                    View Passengers
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewingBookingId !== null && (
        <PassengersModal
          bookingId={viewingBookingId}
          onClose={() => setViewingBookingId(null)}
        />
      )}
    </div>
  );
}