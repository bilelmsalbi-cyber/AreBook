"use client";

import { useState } from "react";
import type { BookingResult, TripOption } from "@/types/booking";
import PassengersModal from "@/components/admin/bookings/PassengersModal";
import AdminCancelBookingModal from "@/components/admin/bookings/AdminCancelBookingModal";

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "Any" },
  { value: "NOT_PAID", label: "Not paid yet" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

const BOOKING_STATUS_OPTIONS = [
  { value: "", label: "Any" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CANCELLED", label: "Cancelled" },
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

function paymentLabel(booking: BookingResult) {
  const effectivePayment = booking.payment ?? booking.linkedBooking?.payment ?? null;
  if (!effectivePayment) return "Not paid yet";
  if (effectivePayment.status === "PAID") return "Paid";
  if (effectivePayment.status === "FAILED") return "Failed";
  if (effectivePayment.status === "REFUNDED") return "Refunded";
  return "Pending";
}

function pnrLabel(booking: BookingResult) {
  return booking.pnr || booking.linkedBooking?.pnr || "—";
}

function priceLabel(booking: BookingResult) {
  const effectivePayment = booking.payment ?? booking.linkedBooking?.payment ?? null;
  if (!effectivePayment) return "—";
  return `$${effectivePayment.amount.toFixed(2)}`;
}

function accountLabel(booking: BookingResult) {
  if (!booking.customer) return "Guest booking";
  const { firstName, lastName, email } = booking.customer.person;
  return `${firstName} ${lastName} (${email})`;
}

function isPastBooking(booking: BookingResult) {
  const now = Date.now();
  const outboundPast = new Date(booking.trip.departureDateTime).getTime() < now;
  if (!booking.returnTrip) return outboundPast;
  const returnPast = new Date(booking.returnTrip.departureDateTime).getTime() < now;
  return outboundPast && returnPast;
}

function isCancellable(booking: BookingResult) {
  return booking.status === "CONFIRMED" && !isPastBooking(booking);
}

// One leg of a trip (outbound or return) rendered as a clickable label —
// tapping it reveals aircraft type + departure/arrival times inline,
// instead of a permanently-visible aircraft-type line that was ambiguous
// on round-trip bookings (which leg does it belong to?). Each leg owns
// its own open/closed state, so expanding the outbound leg never affects
// the return leg's row and vice versa.
function TripLegButton({
  leg,
  prefix,
}: {
  leg: {
    departingPlace: string;
    destination: string;
    departureDateTime: string;
    arrivalDateTime: string;
    plane: { aircraftType: string };
  };
  prefix?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-left underline decoration-dotted underline-offset-2 transition-colors duration-150 hover:text-[#3B82F6] ${
          prefix ? "text-[#3B82F6]" : "text-[#CBD5E1]"
        }`}
      >
        {prefix ? `${prefix} ` : ""}
        {leg.departingPlace} → {leg.destination}
      </button>
      {open && (
        <div className="mt-1 rounded-lg border border-[#1E293B] bg-[#0B0F19] p-2 text-xs text-[#94A3B8]">
          <p>{leg.plane.aircraftType}</p>
          <p>Departs: {formatDateTime(leg.departureDateTime)}</p>
          <p>Arrives: {formatDateTime(leg.arrivalDateTime)}</p>
        </div>
      )}
    </div>
  );
}

function TripCell({ booking }: { booking: BookingResult }) {
  return (
    <div className="space-y-1">
      <TripLegButton leg={booking.trip} />
      {booking.returnTrip && <TripLegButton leg={booking.returnTrip} prefix="↩" />}
    </div>
  );
}

function ActionsMenu({
  isOpen,
  onToggle,
  onClose,
  onViewPassengers,
  cancellable,
  onCancel,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onViewPassengers: () => void;
  cancellable: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Actions"
        className="rounded-lg p-1.5 text-[#64748B] transition-colors duration-150 hover:bg-[#1E293B] hover:text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={onClose}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-9 z-50 w-48 overflow-hidden rounded-lg border border-[#1E293B] bg-[#111827] shadow-xl">
            <button
              type="button"
              onClick={onViewPassengers}
              className="block w-full px-4 py-2.5 text-left text-xs font-medium text-[#CBD5E1] transition-colors duration-150 hover:bg-[#1E293B] hover:text-white"
            >
              View Passengers
            </button>
            {cancellable && (
              <button
                type="button"
                onClick={onCancel}
                className="block w-full border-t border-[#1E293B] px-4 py-2.5 text-left text-xs font-medium text-red-400 transition-colors duration-150 hover:bg-[#1E293B]"
              >
                Cancel Booking
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const emptyFilters = {
  id: "",
  pnr: "",
  name: "",
  status: "",
  bookingStatus: "",
  tripId: "",
  date: "",
};

export default function BookingsManager({
  tripOptions,
  role,
}: {
  tripOptions: TripOption[];
  role: "ADMIN" | "EMPLOYEE";
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
  const [cancellingBooking, setCancellingBooking] = useState<BookingResult | null>(
    null
  );
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  function updateFilter(field: keyof typeof emptyFilters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  async function runSearch() {
    const params = new URLSearchParams();
    if (filters.id.trim()) params.set("id", filters.id.trim());
    if (filters.pnr.trim()) params.set("pnr", filters.pnr.trim());
    if (filters.name.trim()) params.set("name", filters.name.trim());
    if (filters.status) params.set("status", filters.status);
    if (filters.bookingStatus) params.set("bookingStatus", filters.bookingStatus);
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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    runSearch();
  }

  function handleClear() {
    setFilters(emptyFilters);
    setResults([]);
    setHasSearched(false);
    setError(null);
    setExcludePast(true);
  }

  function handleCancelled() {
    setCancellingBooking(null);
    if (hasSearched) runSearch();
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
        className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-[#1E293B] bg-[#111827] p-4 sm:grid-cols-2 md:grid-cols-6"
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
          <label className="mb-1 block text-xs text-[#64748B]">
            Booking Status
          </label>
          <select
            value={filters.bookingStatus}
            onChange={(e) => updateFilter("bookingStatus", e.target.value)}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
          >
            {BOOKING_STATUS_OPTIONS.map((opt) => (
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

        <div className="col-span-1 flex flex-wrap items-end gap-4 sm:col-span-2 md:col-span-6">
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

      {/* ---------- Desktop / tablet: table ---------- */}
      <div className="mt-6 hidden overflow-visible rounded-xl border border-[#1E293B] md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#111827] text-[#64748B]">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">PNR</th>
              <th className="px-4 py-3 font-medium">Passenger(s)</th>
              <th className="px-4 py-3 font-medium">Account</th>
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
                <td colSpan={11} className="px-4 py-6 text-center text-[#64748B]">
                  Enter at least one filter and search.
                </td>
              </tr>
            )}
            {hasSearched && !loading && visibleResults.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-[#64748B]">
                  No bookings match this search.
                </td>
              </tr>
            )}
            {visibleResults.map((booking) => (
              <tr
                key={booking.id}
                className="border-t border-[#1E293B] text-[#CBD5E1] align-top"
              >
                <td className="px-4 py-3">#{booking.id}</td>
                <td className="px-4 py-3">{pnrLabel(booking)}</td>
                <td className="px-4 py-3">{passengerNames(booking)}</td>
                <td className="px-4 py-3 text-xs">{accountLabel(booking)}</td>
                <td className="px-4 py-3">
                  <TripCell booking={booking} />
                </td>
                <td className="px-4 py-3">{booking.seatClass}</td>
                <td className="px-4 py-3">{booking.status}</td>
                <td className="px-4 py-3">{paymentLabel(booking)}</td>
                <td className="px-4 py-3">{priceLabel(booking)}</td>
                <td className="px-4 py-3">
                  {formatDateTime(booking.bookingDate)}
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionsMenu
                    isOpen={openMenuId === booking.id}
                    onToggle={() =>
                      setOpenMenuId(openMenuId === booking.id ? null : booking.id)
                    }
                    onClose={() => setOpenMenuId(null)}
                    onViewPassengers={() => {
                      setViewingBookingId(booking.id);
                      setOpenMenuId(null);
                    }}
                    cancellable={isCancellable(booking)}
                    onCancel={() => {
                      setCancellingBooking(booking);
                      setOpenMenuId(null);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- Mobile: stacked cards ---------- */}
      <div className="mt-6 space-y-3 md:hidden">
        {!hasSearched && (
          <p className="py-6 text-center text-sm text-[#64748B]">
            Enter at least one filter and search.
          </p>
        )}
        {hasSearched && !loading && visibleResults.length === 0 && (
          <p className="py-6 text-center text-sm text-[#64748B]">
            No bookings match this search.
          </p>
        )}
        {visibleResults.map((booking) => (
          <div
            key={booking.id}
            className="rounded-xl border border-[#1E293B] bg-[#111827] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  #{booking.id} — {pnrLabel(booking)}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#94A3B8]">
                  {passengerNames(booking)}
                </p>
              </div>
              <ActionsMenu
                isOpen={openMenuId === booking.id}
                onToggle={() =>
                  setOpenMenuId(openMenuId === booking.id ? null : booking.id)
                }
                onClose={() => setOpenMenuId(null)}
                onViewPassengers={() => {
                  setViewingBookingId(booking.id);
                  setOpenMenuId(null);
                }}
                cancellable={isCancellable(booking)}
                onCancel={() => {
                  setCancellingBooking(booking);
                  setOpenMenuId(null);
                }}
              />
            </div>

            <div className="mt-3 space-y-2 border-t border-[#1E293B] pt-3 text-xs text-[#94A3B8]">
              <TripCell booking={booking} />
              <p>{accountLabel(booking)}</p>
              <p>
                {booking.seatClass} · {booking.status} · {paymentLabel(booking)} ·{" "}
                {priceLabel(booking)}
              </p>
              <p>Booked {formatDateTime(booking.bookingDate)}</p>
            </div>
          </div>
        ))}
      </div>

      {viewingBookingId !== null && (
        <PassengersModal
          bookingId={viewingBookingId}
          onClose={() => setViewingBookingId(null)}
        />
      )}

      {cancellingBooking !== null && (
        <AdminCancelBookingModal
         bookingId={cancellingBooking.id}
         isRoundTrip={cancellingBooking.tripType === "ROUND_TRIP"}
         role={role}
         onClose={() => setCancellingBooking(null)}
         onCancelled={handleCancelled}
/>
      )}
    </div>
  );
}