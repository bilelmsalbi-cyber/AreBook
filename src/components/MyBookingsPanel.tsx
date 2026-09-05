"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import CustomerPassengersModal from "@/components/CustomerPassengersModal";
import GuestPassengersModal from "@/components/GuestPassengersModal";
import CancelBookingModal from "@/components/CancelBookingModal";

type TripSummary = {
  id: number;
  departingPlace: string;
  destination: string;
  departureDateTime: string;
  arrivalDateTime: string;
  plane: { aircraftType: string };
};

type MyBooking = {
  id: number;
  pnr: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  seatClass: "BUSINESS" | "GUEST";
  seatsHeld: number;
  tripType: "ONE_WAY" | "ROUND_TRIP";
  trip: TripSummary;
  returnTrip: TripSummary | null;
  payment: { status: string; amount: number } | null;
};

// Shape returned by POST /api/bookings/lookup — richer than MyBooking
// since there's no follow-up id-based call for guests (see
// GuestPassengersModal): passenger details are already included here.
type GuestPassenger = {
  id: number;
  person: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: string;
    dateBirth: string;
  };
  document: {
    documentType: string;
    number: string;
    country: string;
    expiryDate: string;
  } | null;
  specialRequests: { id: number; requestType: string; price: number }[];
};

type GuestBooking = {
  id: number;
  pnr: string | null;
  tripType: "ONE_WAY" | "ROUND_TRIP";
  seatClass: "BUSINESS" | "GUEST";
  trip: TripSummary;
  passengers: GuestPassenger[];
  payment: { status: string; amount: number } | null;
  linkedBooking: { id: number; trip: TripSummary } | null;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
}

export default function MyBookingsPanel() {
  const { status } = useSession();

  // ---- Logged-in bookings list ----
  const [bookings, setBookings] = useState<MyBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null);

  const loading = status === "authenticated" && bookings === null && !error;

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;

    fetch("/api/bookings")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setError(data.error || "Failed to load your bookings.");
          return;
        }
        setBookings(data.bookings ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load your bookings.");
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  function handleCancelled(bookingId: number) {
    setBookings((prev) => prev?.filter((b) => b.id !== bookingId) ?? prev);
  }

  // ---- Guest lookup (PNR + last name) ----
  const [pnrInput, setPnrInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundBooking, setFoundBooking] = useState<GuestBooking | null>(null);
  const [showGuestPassengers, setShowGuestPassengers] = useState(false);
  const [showGuestCancel, setShowGuestCancel] = useState(false);

  function handleGuestSearch(e: React.FormEvent) {
    e.preventDefault();

    const pnr = pnrInput.trim();
    const lastName = nameInput.trim();

    if (!pnr || !lastName) {
      setSearchError("Please enter both your PNR and last name.");
      return;
    }

    setSearching(true);
    setSearchError(null);
    setFoundBooking(null);

    fetch("/api/bookings/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pnr, lastName }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, status, data }) => {
        if (!ok) {
          if (status === 429) {
            setSearchError(data.error || "Too many attempts. Please wait a moment and try again.");
          } else {
            // Deliberately generic for every other failure (400/404) — the
            // backend already collapses "not found", "name mismatch", "not
            // eligible", and "belongs to an account" into this one message,
            // and the UI must not add distinguishing detail on top of it.
            setSearchError(data.error || "No booking found. Please check your PNR and last name.");
          }
          return;
        }
        setFoundBooking(data.booking);
      })
      .catch(() => {
        setSearchError("Could not reach the server. Please check your connection and try again.");
      })
      .finally(() => {
        setSearching(false);
      });
  }

  function handleGuestCancelled() {
    // The booking is no longer active — nothing left to show or act on.
    setFoundBooking(null);
  }

  function resetGuestSearch() {
    setFoundBooking(null);
    setSearchError(null);
    setPnrInput("");
    setNameInput("");
  }

  // ---- Not logged in: PNR + name lookup ----
  if (status !== "loading" && status !== "authenticated") {
    return (
      <div className="mx-auto max-w-md">
        {!foundBooking ? (
          <>
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-700">
              If you booked while logged in, you must log in first to manage that booking .
            </p>
            <p className="mb-4 text-sm text-[#5C7A96]">
              Enter your booking reference (PNR) and the name on the booking to find it.
            </p>
            <form onSubmit={handleGuestSearch} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#5C7A96]">
                  Booking Reference (PNR)
                </label>
                <input
                  type="text"
                  value={pnrInput}
                  onChange={(e) => setPnrInput(e.target.value)}
                  disabled={searching}
                  placeholder="ABC123"
                  className="w-full rounded-lg border border-[#E8DFCC] bg-[#FAF6EC] px-4 py-3 text-[#16324F] placeholder-[#B3A488] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#B8863F] focus:bg-white focus:shadow-md disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#5C7A96]">
                  Last Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  disabled={searching}
                  placeholder="Doe"
                  className="w-full rounded-lg border border-[#E8DFCC] bg-[#FAF6EC] px-4 py-3 text-[#16324F] placeholder-[#B3A488] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#B8863F] focus:bg-white focus:shadow-md disabled:opacity-60"
                />
              </div>

              {searchError && <p className="text-sm text-red-500">{searchError}</p>}

              <button
                type="submit"
                disabled={searching}
                className="w-full rounded-xl bg-linear-to-r from-[#B8863F] to-[#C89A5B] py-3.5 font-semibold text-white transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:from-[#A97535] hover:to-[#B8863F] hover:shadow-xl disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {searching ? "Searching..." : "Find My Booking"}
              </button>
            </form>
          </>
        ) : (
          <div>
            <div className="rounded-xl border border-[#EADFC7] bg-[#FAF6EC] p-5">
              <p className="text-sm font-medium text-[#5C7A96]">
                {foundBooking.tripType === "ROUND_TRIP" ? "Round Trip" : "One Way"} · PNR{" "}
                {foundBooking.pnr ?? "—"}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#16324F]">
                {foundBooking.trip.departingPlace} → {foundBooking.trip.destination}
              </p>
              <p className="text-xs text-[#5C7A96]">
                {formatDateTime(foundBooking.trip.departureDateTime)} ·{" "}
                {foundBooking.trip.plane.aircraftType} · {foundBooking.seatClass}
              </p>

              {foundBooking.linkedBooking && (
                <>
                  <p className="mt-2 text-sm font-semibold text-[#16324F]">
                    {foundBooking.linkedBooking.trip.departingPlace} →{" "}
                    {foundBooking.linkedBooking.trip.destination}
                  </p>
                  <p className="text-xs text-[#5C7A96]">
                    {formatDateTime(foundBooking.linkedBooking.trip.departureDateTime)} ·{" "}
                    {foundBooking.linkedBooking.trip.plane.aircraftType} · {foundBooking.seatClass}
                  </p>
                </>
              )}

              {foundBooking.payment && (
                <p className="mt-2 text-sm font-semibold text-[#16324F]">
                  {foundBooking.payment.amount} TND
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowGuestPassengers(true)}
                  className="rounded-lg border border-[#B8863F] px-4 py-2 text-sm font-semibold text-[#B8863F] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#FBF7EE]"
                >
                  Show Passengers Info
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuestCancel(true)}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-500 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-50"
                >
                  Cancel
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={resetGuestSearch}
              className="mt-4 w-full rounded-xl border border-[#E8DFCC] py-2.5 text-sm font-semibold text-[#16324F] transition-all duration-200 hover:bg-[#FAF6EC]"
            >
              Search for a different booking
            </button>
          </div>
        )}

        {foundBooking && showGuestPassengers && (
          <GuestPassengersModal
            bookingId={foundBooking.id}
            passengers={foundBooking.passengers}
            onClose={() => setShowGuestPassengers(false)}
          />
        )}

        {foundBooking && showGuestCancel && (
          <CancelBookingModal
            bookingId={foundBooking.id}
            isRoundTrip={foundBooking.tripType === "ROUND_TRIP"}
            guestAuth={{ pnr: pnrInput.trim(), lastName: nameInput.trim() }}
            onClose={() => setShowGuestCancel(false)}
            onCancelled={handleGuestCancelled}
          />
        )}
      </div>
    );
  }

  // ---- Logged in: list of upcoming confirmed bookings ----
  return (
    <div>
      {(loading || status === "loading") && (
        <p className="text-sm text-[#5C7A96]">Loading your bookings...</p>
      )}

      {!loading && error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && (bookings?.length ?? 0) === 0 && (
        <p className="text-sm text-[#5C7A96]">
          You don&apos;t have any upcoming bookings.
        </p>
      )}

      <div className="space-y-4">
        {!loading &&
          !error &&
          bookings?.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-[#EADFC7] bg-[#FAF6EC] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[#5C7A96]">
                    {b.tripType === "ROUND_TRIP" ? "Round Trip" : "One Way"} · PNR{" "}
                    {b.pnr ?? "—"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#16324F]">
                    {b.trip.departingPlace} → {b.trip.destination}
                  </p>
                  <p className="text-xs text-[#5C7A96]">
                    {formatDateTime(b.trip.departureDateTime)} ·{" "}
                    {b.trip.plane.aircraftType} · {b.seatClass}
                  </p>

                  {b.returnTrip && (
                    <>
                      <p className="mt-2 text-sm font-semibold text-[#16324F]">
                        {b.returnTrip.departingPlace} → {b.returnTrip.destination}
                      </p>
                      <p className="text-xs text-[#5C7A96]">
                        {formatDateTime(b.returnTrip.departureDateTime)} ·{" "}
                        {b.returnTrip.plane.aircraftType} · {b.seatClass}
                      </p>
                    </>
                  )}
                </div>

                {b.payment && (
                  <p className="text-sm font-semibold text-[#16324F]">
                    {b.payment.amount} TND
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedBookingId(b.id)}
                  className="rounded-lg border border-[#B8863F] px-4 py-2 text-sm font-semibold text-[#B8863F] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#FBF7EE]"
                >
                  Show Passengers Info
                </button>
                <button
                  type="button"
                  onClick={() => setCancellingBookingId(b.id)}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-500 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
      </div>

      {selectedBookingId && (
        <CustomerPassengersModal
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
        />
      )}

      {cancellingBookingId && (
        <CancelBookingModal
          bookingId={cancellingBookingId}
          isRoundTrip={
            bookings?.find((b) => b.id === cancellingBookingId)?.tripType === "ROUND_TRIP"
          }
          onClose={() => setCancellingBookingId(null)}
          onCancelled={handleCancelled}
        />
      )}
    </div>
  );
}