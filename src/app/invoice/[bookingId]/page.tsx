"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type SpecialRequest = {
  id: number;
  requestType: string;
  price: number;
};

type PersonInfo = {
  firstName: string;
  lastName: string;
  email: string;
};

type DocumentInfo = {
  documentType: string;
  number: string;
  country: string;
};

type PassengerInfo = {
  id: number;
  person: PersonInfo;
  document: DocumentInfo | null;
  specialRequests: SpecialRequest[];
};

type FullTripInfo = {
  departingPlace: string;
  destination: string;
  departureDateTime: string;
  priceGuest: number;
  priceBusiness: number;
  plane: { aircraftType: string };
};

type PaymentSummary = {
  amount: number;
  status: string;
};

type BookingDetails = {
  id: number;
  seatClass: "GUEST" | "BUSINESS";
  seatsHeld: number;
  trip: FullTripInfo;
  passengers: PassengerInfo[];
  payment: PaymentSummary | null;
  // Present only for round-trip bookings.
  linkedBooking: {
    id: number;
    seatClass: "GUEST" | "BUSINESS";
    trip: FullTripInfo;
    passengers: PassengerInfo[];
    payment: PaymentSummary | null;
  } | null;
};

type MergedService = {
  key: string;
  label: string;
  unitPrice: number;
  count: number;
  total: number;
};

function mergeServices(requests: SpecialRequest[]): MergedService[] {
  const groups = new Map<string, MergedService>();

  for (const r of requests) {
    const key = `${r.requestType}::${r.price}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.total += r.price;
    } else {
      groups.set(key, {
        key,
        label: r.requestType,
        unitPrice: r.price,
        count: 1,
        total: r.price,
      });
    }
  }

  return Array.from(groups.values());
}

function InvoiceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingId = params.bookingId as string;
  // Guest access token carried forward from the booking flow (see
  // api/bookings/route.ts and api/bookings/[id]/route.ts) — required to
  // view this booking before it's linked to any session.
  const token = searchParams.get("token") || "";

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchBooking() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}?token=${token}`);

        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to fetch booking (status ${res.status})`);
        }

        const data = await res.json();
        setBooking(data);
      } catch (err) {
        setFetchError(err instanceof Error ? err : new Error("Unknown error"));
      }
    }
    fetchBooking();
  }, [bookingId, token]);

  const returnLeg = booking?.linkedBooking ?? null;
  const isRoundTrip = !!returnLeg;

  const outboundClassPrice = booking
    ? booking.seatClass === "BUSINESS"
      ? booking.trip.priceBusiness
      : booking.trip.priceGuest
    : 0;
  const outboundFare = booking ? outboundClassPrice * booking.passengers.length : 0;

  const returnClassPrice = returnLeg
    ? returnLeg.seatClass === "BUSINESS"
      ? returnLeg.trip.priceBusiness
      : returnLeg.trip.priceGuest
    : 0;
  const returnFare = returnLeg && booking ? returnClassPrice * booking.passengers.length : 0;

  // The discount tiers now live in the database, so the discounted seat
  // total can no longer be computed locally — it's fetched from the same
  // /api/pricing/preview endpoint used by the booking page.
  const [seatsDiscounted, setSeatsDiscounted] = useState<number | null>(null);
  const [pricingError, setPricingError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isRoundTrip || !booking) {
      return;
    }

    async function loadDiscount() {
      try {
        const res = await fetch("/api/pricing/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outboundFare, returnFare }),
        });
        if (!res.ok) {
          throw new Error("Failed to fetch pricing preview");
        }
        const data = await res.json();
        setSeatsDiscounted(data.discounted);
      } catch (err) {
        setPricingError(err instanceof Error ? err : new Error("Unknown error"));
      }
    }

    loadDiscount();
  }, [isRoundTrip, booking, outboundFare, returnFare]);

  if (fetchError) {
    throw fetchError;
  }
  if (pricingError) {
    throw pricingError;
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF]">
        <p className="text-[#5C7A96]">Booking not found.</p>
      </main>
    );
  }

  // Not ready to render until the booking is loaded, and — for round
  // trips — until the discounted price has come back too.
  if (!booking || (isRoundTrip && seatsDiscounted === null)) {
    return null; // loading.tsx handles this
  }

  // Shown as ONE combined seat price (outbound + return together), not two
  // separate lines — the split by leg isn't useful to the traveler, only
  // the round-trip total (and the discount applied to it) matters.
  const seatPricePerTraveler = outboundClassPrice + returnClassPrice;
  const seatsOriginal = outboundFare + returnFare;
  const seatsFinal = isRoundTrip ? seatsDiscounted! : seatsOriginal;
  const seatsSavings = seatsOriginal - seatsFinal;

  // Passengers are created once per leg, in the same order (see
  // checkout/route.ts) — so index i on the outbound leg is the same
  // traveler as index i on the return leg. Combine their services here
  // to get each traveler's true total across both flights.
  function servicesForTraveler(index: number): SpecialRequest[] {
    const outboundServices = booking!.passengers[index]?.specialRequests || [];
    const returnServices = returnLeg?.passengers[index]?.specialRequests || [];
    return [...outboundServices, ...returnServices];
  }

  const servicesSubtotal = booking.passengers.reduce(
    (sum, _p, index) =>
      sum + servicesForTraveler(index).reduce((s, r) => s + r.price, 0),
    0
  );

  // The authoritative amount always comes from the Payment row — it's the
  // only place the round-trip discount is actually applied (see
  // checkout/route.ts). A round-trip's return leg has no Payment of its
  // own, so we fall back to the linked (outbound) leg's Payment.
  const effectivePayment = booking.payment ?? returnLeg?.payment ?? null;

  // Fallback for the rare case the invoice is viewed before checkout has
  // run yet (no Payment created) — matches the previous One-Way behavior.
  const total = effectivePayment?.amount ?? seatsFinal + servicesSubtotal;

  async function handlePayment() {
    const res = await fetch(`/api/bookings/${bookingId}/pay`, { method: "POST" });
    const data = await res.json();
      if (!res.ok || !data.url) {
        alert(data.error || "Could not start payment.");
        return;
      }
       window.location.href = data.url;
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF] text-[#16324F]">
      <section className="bg-linear-to-r from-[#1D4ED8] via-[#2563EB] to-[#60A5FA] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-xs tracking-[0.2em] text-[#DCEEFF]">
            BOOKING #{booking.id}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">Booking Invoice</h1>

          <p className="mt-1 text-sm text-[#DCEEFF]">
            {returnLeg ? "Outbound: " : ""}
            {booking.trip.departingPlace} to {booking.trip.destination} —{" "}
            {new Date(booking.trip.departureDateTime).toLocaleString("en-GB")} —{" "}
            {booking.trip.plane.aircraftType}
          </p>

          {returnLeg && (
            <p className="mt-1 text-sm text-[#DCEEFF]">
              Return: {returnLeg.trip.departingPlace} to {returnLeg.trip.destination} —{" "}
              {new Date(returnLeg.trip.departureDateTime).toLocaleString("en-GB")} —{" "}
              {returnLeg.trip.plane.aircraftType}
            </p>
          )}
        </div>
      </section>

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-4xl space-y-6">
          {booking.passengers.map((passenger, index) => {
            const mergedServices = mergeServices(servicesForTraveler(index));
            const servicesTotal = mergedServices.reduce((s, m) => s + m.total, 0);
            const passengerTotal = seatPricePerTraveler + servicesTotal;
            return (
              <div
                key={passenger.id}
                className="rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[#16324F]">
                    Passenger {index + 1}: {passenger.person.firstName} {passenger.person.lastName}
                  </h2>
                  <span className="text-sm text-[#5C7A96]">{passenger.person.email}</span>
                </div>

                {passenger.document && (
                  <p className="mt-1 text-sm text-[#5C7A96]">
                    {passenger.document.documentType}: {passenger.document.number} (
                    {passenger.document.country})
                  </p>
                )}

                <div className="mt-4 space-y-2 border-t border-[#DCEEFF] pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#5C7A96]">
                      {booking.seatClass === "BUSINESS" ? "Business" : "Guest"} class seat
                      {isRoundTrip ? " (round trip)" : ""}
                    </span>
                    <span className="font-medium text-[#16324F]">
                      {seatPricePerTraveler.toFixed(2)} TND
                    </span>
                  </div>

                  {mergedServices.map((service) => (
                    <div key={service.key} className="flex justify-between text-sm">
                      <span className="text-[#5C7A96]">
                        {service.label}
                        {service.count > 1 ? ` x${service.count}` : ""}
                      </span>
                      <span className="font-medium text-[#16324F]">
                        {service.total === 0 ? "Free" : `${service.total.toFixed(2)} TND`}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-between border-t border-[#DCEEFF] pt-3 text-sm font-semibold">
                  <span className="text-[#16324F]">Passenger total</span>
                  <span className="text-[#16324F]">{passengerTotal.toFixed(2)} TND</span>
                </div>
              </div>
            );
          })}

          <div className="rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)]">
            <div className="flex justify-between text-sm text-[#5C7A96]">
              <span>Seats ({booking.passengers.length}){returnLeg ? " — round trip" : ""}</span>
              <div className="text-right">
                {isRoundTrip && seatsSavings > 0 ? (
                  <>
                    <span className="text-[#9DB6CF] line-through">{seatsOriginal.toFixed(2)} TND</span>
                    <span className="ml-2 font-medium text-[#16324F]">
                      {seatsFinal.toFixed(2)} TND
                    </span>
                  </>
                ) : (
                  <span>{seatsOriginal.toFixed(2)} TND</span>
                )}
              </div>
            </div>
            {isRoundTrip && seatsSavings > 0 && (
              <div className="mt-1 flex justify-end text-xs font-medium text-emerald-600">
                You saved {seatsSavings.toFixed(2)} TND on fares
              </div>
            )}
            <div className="mt-2 flex justify-between text-sm text-[#5C7A96]">
              <span>Services{returnLeg ? " — both flights" : ""}</span>
              <span>{servicesSubtotal.toFixed(2)} TND</span>
            </div>
            <div className="mt-3 flex items-start justify-between border-t border-[#DCEEFF] pt-3 text-xl font-bold text-[#16324F]">
              <span>Total</span>
              <div className="text-right">
                <span>{total.toFixed(2)} TND</span>
                {returnLeg && effectivePayment && (
                  <p className="mt-0.5 text-xs font-normal text-[#5C7A96]">
                    Round-trip fare discount already applied to seats
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePayment}
            className="w-full rounded-xl bg-linear-to-r from-[#2563EB] to-[#3B82F6] py-3.5 font-semibold text-white transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:shadow-xl"
          >
           Proceed to Payment
          </button>
        </div>
      </section>
    </main>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={null}>
      <InvoiceContent />
    </Suspense>
  );
}