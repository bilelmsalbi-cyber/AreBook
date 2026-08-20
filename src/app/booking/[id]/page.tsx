"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";

type Trip = {
  id: number;
  departureDateTime: string;
  arrivalDateTime: string;
  departingPlace: string;
  destination: string;
  priceBusiness: number;
  priceGuest: number;
  availableSeatsBusiness: number;
  availableSeatsGuest: number;
  plane: {
    aircraftType: string;
  };
};

type PricingPreview = {
  original: number;
  discounted: number;
  savings: number;
};

const GUEST_FEATURES = [
  "Standard seat",
  "1 checked bag (20kg)",
  "Complimentary snack & drink",
  "Standard boarding",
];

const BUSINESS_FEATURES = [
  "Extra legroom seat",
  "2 checked bags (32kg each)",
  "Priority check-in & boarding",
  "Premium meal & beverage service",
  "Lounge access",
];

async function fetchPricingPreview(outboundFare: number, returnFare: number): Promise<PricingPreview> {
  const res = await fetch("/api/pricing/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outboundFare, returnFare }),
  });
  if (!res.ok) {
    throw new Error("Failed to compute pricing preview");
  }
  return res.json();
}

function BookingContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isBooking, setIsBooking] = useState(false);

  const returnTripId = params.id as string;
  const adults = parseInt(searchParams.get("adults") || "1", 10);
  const children = parseInt(searchParams.get("children") || "0", 10);
  const seatsNeeded = adults + children;

  const tripType = searchParams.get("tripType") || "ONE_WAY";
  const isRoundTrip = tripType === "ROUND_TRIP";
  const outboundTripId = searchParams.get("outboundTripId") || "";

  // In one-way mode, "trip" holds the only leg.
  // In round-trip mode, "trip" holds the return leg and "outboundTrip"
  // holds the outbound leg — both must be loaded before showing the page.
  const [trip, setTrip] = useState<Trip | null>(null);
  const [outboundTrip, setOutboundTrip] = useState<Trip | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  // Round-trip pricing (with the DB-driven discount applied) — fetched
  // from the server, never computed locally in the browser.
  const [guestPricing, setGuestPricing] = useState<PricingPreview | null>(null);
  const [businessPricing, setBusinessPricing] = useState<PricingPreview | null>(null);
  const [pricingLoading, setPricingLoading] = useState(isRoundTrip);

  useEffect(() => {
    async function fetchTrips() {
      try {
        const idsToFetch = isRoundTrip ? [returnTripId, outboundTripId] : [returnTripId];

        const responses = await Promise.all(
          idsToFetch.map((id) => fetch(`/api/flights/${id}`))
        );

        for (const res of responses) {
          if (!res.ok) {
            throw new Error(`Failed to fetch trip (status ${res.status})`);
          }
        }

        const data = await Promise.all(responses.map((res) => res.json()));

        for (const trip of data) {
          if (trip.error) {
            throw new Error(trip.error);
          }
        }

        const [returnLegData, outboundLegData] = data;

        if (!returnLegData || !returnLegData.id) {
          setNotFound(true);
          return;
        }
        if (isRoundTrip && (!outboundLegData || !outboundLegData.id)) {
          setNotFound(true);
          return;
        }

        setTrip(returnLegData);
        if (isRoundTrip) {
          setOutboundTrip(outboundLegData);
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err : new Error("Unknown error"));
      }
    }
    fetchTrips();
  }, [returnTripId, outboundTripId, isRoundTrip]);

  // Once both legs are loaded (round trip only), fetch the discounted
  // price for both seat classes in parallel — the discount tiers now live
  // in the database, so this can no longer be computed client-side.
  useEffect(() => {
    if (!isRoundTrip || !trip || !outboundTrip) {
      return;
    }

    async function loadPricing() {
      setPricingLoading(true);
      try {
        const [guest, business] = await Promise.all([
          fetchPricingPreview(
            outboundTrip!.priceGuest * seatsNeeded,
            trip!.priceGuest * seatsNeeded
          ),
          fetchPricingPreview(
            outboundTrip!.priceBusiness * seatsNeeded,
            trip!.priceBusiness * seatsNeeded
          ),
        ]);
        setGuestPricing(guest);
        setBusinessPricing(business);
      } catch (err) {
        setFetchError(err instanceof Error ? err : new Error("Failed to load pricing"));
      } finally {
        setPricingLoading(false);
      }
    }

    loadPricing();
  }, [isRoundTrip, trip, outboundTrip, seatsNeeded]);

  // Re-throw during render so Next.js's error.tsx boundary catches it
  if (fetchError) {
    throw fetchError;
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF]">
        <p className="text-[#5C7A96]">Trip not found.</p>
      </main>
    );
  }

  async function handleConfirm(seatClass: "GUEST" | "BUSINESS") {
    setIsBooking(true);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isRoundTrip
          ? {
              tripType: "ROUND_TRIP",
              outboundTripId: parseInt(outboundTripId, 10),
              returnTripId: trip!.id,
              seatClass,
              adults,
              children,
            }
          : {
              tripId: trip!.id,
              tripType: "ONE_WAY",
              seatClass,
              adults,
              children,
            }
      ),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Something went wrong.");
      setIsBooking(false);
      return;
    }

    // The outbound booking is always the primary one — passenger data
    // and the linked return leg are managed from there.
    const primaryBookingId = isRoundTrip ? data.outboundBooking.id : data.id;
    router.push(`/passengers/${primaryBookingId}?adults=${adults}&children=${children}`);
  }

  if (!trip || (isRoundTrip && !outboundTrip) || (isRoundTrip && pricingLoading)) {
    return null; // loading.tsx handles the loading state
  }

  const guestAvailable =
    trip.availableSeatsGuest >= seatsNeeded &&
    (!isRoundTrip || outboundTrip!.availableSeatsGuest >= seatsNeeded);
  const businessAvailable =
    trip.availableSeatsBusiness >= seatsNeeded &&
    (!isRoundTrip || outboundTrip!.availableSeatsBusiness >= seatsNeeded);

  // One-way: no discount applies, just the per-seat price × seats needed.
  // Round-trip: the discounted values come from the server (guestPricing /
  // businessPricing), already fetched above.
  const guestDisplay: PricingPreview = isRoundTrip
    ? guestPricing!
    : { original: trip.priceGuest * seatsNeeded, discounted: trip.priceGuest * seatsNeeded, savings: 0 };

  const businessDisplay: PricingPreview = isRoundTrip
    ? businessPricing!
    : {
        original: trip.priceBusiness * seatsNeeded,
        discounted: trip.priceBusiness * seatsNeeded,
        savings: 0,
      };

  return (
    <main className="min-h-screen bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF] text-[#16324F]">
      <section className="bg-linear-to-r from-[#1D4ED8] via-[#2563EB] to-[#60A5FA] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          {isRoundTrip ? (
            <>
              <p className="font-mono text-xs tracking-[0.2em] text-[#DCEEFF]">
                ROUND TRIP
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
                {outboundTrip!.departingPlace} to {outboundTrip!.destination}
              </h1>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wider text-[#DCEEFF]">Outbound</p>
                  <p className="mt-1 text-sm text-white">
                    {outboundTrip!.departingPlace} &rarr; {outboundTrip!.destination}
                  </p>
                  <p className="text-xs text-[#DCEEFF]">
                    {new Date(outboundTrip!.departureDateTime).toLocaleString("en-GB")}
                  </p>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wider text-[#DCEEFF]">Return</p>
                  <p className="mt-1 text-sm text-white">
                    {trip.departingPlace} &rarr; {trip.destination}
                  </p>
                  <p className="text-xs text-[#DCEEFF]">
                    {new Date(trip.departureDateTime).toLocaleString("en-GB")}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="font-mono text-xs tracking-[0.2em] text-[#DCEEFF]">
                {trip.plane.aircraftType}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
                {trip.departingPlace} to {trip.destination}
              </h1>
              <p className="mt-1 text-sm text-[#DCEEFF]">
                {new Date(trip.departureDateTime).toLocaleString("en-GB")}
              </p>
            </>
          )}
        </div>
      </section>
      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-6 text-lg font-semibold text-[#16324F]">
            Choose your class — {seatsNeeded} seat(s) needed
            {isRoundTrip && " · applies to both flights"}
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ClassCard
              className="Guest"
              features={GUEST_FEATURES}
              pricing={guestDisplay}
              available={guestAvailable}
              isBooking={isBooking}
              onConfirm={() => handleConfirm("GUEST")}
            />
            <ClassCard
              className="Business"
              features={BUSINESS_FEATURES}
              pricing={businessDisplay}
              available={businessAvailable}
              isBooking={isBooking}
              onConfirm={() => handleConfirm("BUSINESS")}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function ClassCard({
  className,
  features,
  pricing,
  available,
  onConfirm,
  isBooking,
}: {
  className: string;
  features: string[];
  pricing: { original: number; discounted: number; savings: number };
  available: boolean;
  onConfirm: () => void;
  isBooking: boolean;
}) {
  const imageSrc = className === "Business" ? "/business_class.jpg" : "/guest_class.jpg";
  const hasDiscount = pricing.savings > 0;

  return (
    <div className="flex flex-col rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:rounded-3xl hover:shadow-[0_20px_40px_-15px_rgba(37,99,235,0.3)]">
      <div className="relative h-40 w-full overflow-hidden rounded-xl bg-[#F3F9FF]">
        <Image
          src={imageSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-contain"
        />
      </div>

      <h3 className="mt-4 text-lg font-bold text-[#16324F]">{className}</h3>

      <ul className="mt-3 flex-1 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-[#5C7A96]">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {hasDiscount ? (
          <>
            <p className="text-sm text-[#9DB6CF] line-through">
              {pricing.original.toFixed(2)} TND
            </p>
            <p className="text-3xl font-bold text-[#16324F]">
              {pricing.discounted.toFixed(2)} TND
            </p>
            <p className="mt-1 text-sm font-medium text-emerald-600">
              You save {pricing.savings.toFixed(2)} TND
            </p>
          </>
        ) : (
          <p className="text-3xl font-bold text-[#16324F]">
            {pricing.discounted.toFixed(2)} TND
          </p>
        )}
      </div>

      {!available && (
        <p className="mt-2 text-sm font-medium text-red-500">
          Not enough seats available in this class.
        </p>
      )}

      <button
        disabled={!available || isBooking}
        onClick={onConfirm}
        className={
          available && !isBooking
          ? "mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#2563EB] to-[#3B82F6] py-3 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:rounded-2xl hover:shadow-xl"
         : "mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-gray-300 py-3 font-semibold text-gray-500"
        }
      >
      {isBooking ? (
      <>
       <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
       <span>Please wait a moment...</span>
      </>
    ) : (
      "Confirm"
    )}
</button>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={null}>
      <BookingContent />
    </Suspense>
  );
}