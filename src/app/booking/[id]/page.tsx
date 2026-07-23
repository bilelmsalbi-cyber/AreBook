"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams, useSearchParams } from "next/navigation";

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

function BookingContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isBooking, setIsBooking] = useState(false);

  const tripId = params.id as string;
  const adults = parseInt(searchParams.get("adults") || "1", 10);
  const children = parseInt(searchParams.get("children") || "0", 10);
  const seatsNeeded = adults + children;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchTrip() {
      try {
        const res = await fetch(`/api/flights/${tripId}`);

        if (!res.ok) {
          throw new Error(`Failed to fetch trip (status ${res.status})`);
        }

        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        if (!data || !data.id) {
          setNotFound(true);
          return;
        }

        setTrip(data);
      } catch (err) {
        setFetchError(err instanceof Error ? err : new Error("Unknown error"));
      }
    }
    fetchTrip();
  }, [tripId]);

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
      body: JSON.stringify({
        tripId: trip!.id,
        tripType: "ONE_WAY",
        seatClass,
        adults,
        children,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Something went wrong.");
      setIsBooking(false);
      return;
    }
    router.push(`/passengers/${data.id}?adults=${adults}&children=${children}`);
  }

  if (!trip) {
    return null; // loading.tsx handles the loading state
  }

  const guestAvailable = trip.availableSeatsGuest >= seatsNeeded;
  const businessAvailable = trip.availableSeatsBusiness >= seatsNeeded;

  return (
    <main className="min-h-screen bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF] text-[#16324F]">
      <section className="bg-linear-to-r from-[#1D4ED8] via-[#2563EB] to-[#60A5FA] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-xs tracking-[0.2em] text-[#DCEEFF]">
            {trip.plane.aircraftType}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            {trip.departingPlace} to {trip.destination}
          </h1>
          <p className="mt-1 text-sm text-[#DCEEFF]">
            {new Date(trip.departureDateTime).toLocaleString("en-GB")}
          </p>
        </div>
      </section>
      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-6 text-lg font-semibold text-[#16324F]">
            Choose your class — {seatsNeeded} seat(s) needed
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ClassCard
              className="Guest"
              features={GUEST_FEATURES}
              price={trip.priceGuest}
              available={guestAvailable}
              isBooking={isBooking}
              onConfirm={() => handleConfirm("GUEST")}
            />
            <ClassCard
              className="Business"
              features={BUSINESS_FEATURES}
              price={trip.priceBusiness}
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
  price,
  available,
  onConfirm,
  isBooking,
}: {
  className: string;
  features: string[];
  price: number;
  available: boolean;
  onConfirm: () => void;
  isBooking: boolean;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:rounded-3xl hover:shadow-[0_20px_40px_-15px_rgba(37,99,235,0.3)]">
      <div className="mb-4 flex h-36 items-center justify-center rounded-xl bg-[#F3F9FF] text-xs text-[#9DB6CF]">
        Image placeholder
      </div>

      <h3 className="text-lg font-bold text-[#16324F]">{className}</h3>

      <ul className="mt-3 flex-1 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-[#5C7A96]">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
            {feature}
          </li>
        ))}
      </ul>

      <p className="mt-5 text-3xl font-bold text-[#16324F]">{price} TND</p>

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