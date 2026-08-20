"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PlaneLoader from "@/components/PlaneLoader";
import { FLIGHTS_PAGE_SIZE } from "@/lib/flightsPagination";

type Trip = {
  id: number;
  departureDateTime: string;
  arrivalDateTime: string;
  departingPlace: string;
  destination: string;
  priceBusiness: number;
  priceGuest: number;
  plane: {
    aircraftType: string;
  };
};

type FlightsResponse = {
  trips: Trip[];
  hasMore: boolean;
};

function ResultsContent() {
  const searchParams = useSearchParams();

  const departingPlace = searchParams.get("departingPlace") || "";
  const destination = searchParams.get("destination") || "";
  const departureDate = searchParams.get("departureDate") || "";
  const adults = searchParams.get("adults") || "1";
  const children = searchParams.get("children") || "0";
  const infants = searchParams.get("infants") || "0";

  const tripType = searchParams.get("tripType") || "ONE_WAY";
  const leg = searchParams.get("leg") || "outbound";
  const returnDate = searchParams.get("returnDate") || "";
  const outboundTripId = searchParams.get("outboundTripId") || "";
  const outboundDeparture = searchParams.get("outboundDeparture") || "";
  const outboundArrival = searchParams.get("outboundArrival") || "";

  const isRoundTrip = tripType === "ROUND_TRIP";
  const isReturnLeg = isRoundTrip && leg === "return";

  const [results, setResults] = useState<Trip[]>([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showAllClicked, setShowAllClicked] = useState(false);

  // ---- Early return-flight availability check ----
  // On the outbound leg of a round trip, we confirm there's at least one
  // flight on the reversed route BEFORE letting the user pick an outbound
  // flight — regardless of whether a return date was specified. This avoids
  // the frustrating scenario where a user goes through the whole outbound
  // selection only to discover, at the return leg, that no return flights
  // exist at all.
  const shouldCheckReturn = isRoundTrip && !isReturnLeg;
  const [checkingReturn, setCheckingReturn] = useState(shouldCheckReturn);
  const [noReturnFlights, setNoReturnFlights] = useState(false);

  useEffect(() => {
    if (!shouldCheckReturn) {
      return;
    }

    async function checkReturnAvailability() {
      setCheckingReturn(true);

      const params = new URLSearchParams();
      params.set("departingPlace", destination); // reversed direction
      params.set("destination", departingPlace); // reversed direction
      if (returnDate) params.set("departureDate", returnDate);
      params.set("take", "1"); // existence check only, no need for a full page

      const res = await fetch(`/api/flights?${params.toString()}`);
      const data: FlightsResponse = await res.json();

      setNoReturnFlights(!Array.isArray(data.trips) || data.trips.length === 0);
      setCheckingReturn(false);
    }

    checkReturnAvailability();
  }, [shouldCheckReturn, departingPlace, destination, returnDate]);

  // ---- Outbound / return leg flight search (page 1) ----
  async function buildSearchParams(skipValue: number, dropDate: boolean) {
    const params = new URLSearchParams();
    params.set("departingPlace", departingPlace);
    params.set("destination", destination);
    if (!dropDate && departureDate) params.set("departureDate", departureDate);
    if (isReturnLeg && outboundArrival) {
      params.set("afterDateTime", outboundArrival);
    }
    params.set("skip", skipValue.toString());
    return params;
  }

  useEffect(() => {
    async function fetchTrips() {
      setIsLoading(true);
      setShowAllClicked(false);

      const params = await buildSearchParams(0, false);
      const res = await fetch(`/api/flights?${params.toString()}`);
      const data: FlightsResponse = await res.json();

      const trips = Array.isArray(data.trips) ? data.trips : [];
      setResults(trips);
      setSkip(trips.length);
      setHasMore(!!data.hasMore);
      setIsLoading(false);
    }

    fetchTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departingPlace, destination, departureDate, isReturnLeg, outboundArrival]);

  async function handleShowAllFlights() {
    setIsLoading(true);
    setShowAllClicked(true);

    const params = await buildSearchParams(0, true);
    const res = await fetch(`/api/flights?${params.toString()}`);
    const data: FlightsResponse = await res.json();

    const trips = Array.isArray(data.trips) ? data.trips : [];
    setResults(trips);
    setSkip(trips.length);
    setHasMore(!!data.hasMore);
    setIsLoading(false);
  }

  async function handleLoadMore() {
    setIsLoadingMore(true);

    const params = await buildSearchParams(skip, showAllClicked);
    const res = await fetch(`/api/flights?${params.toString()}`);
    const data: FlightsResponse = await res.json();

    const trips = Array.isArray(data.trips) ? data.trips : [];
    setResults((prev) => [...prev, ...trips]);
    setSkip((prev) => prev + trips.length);
    setHasMore(!!data.hasMore);
    setIsLoadingMore(false);
  }

  function getTripHref(trip: Trip) {
    if (!isRoundTrip) {
      return `/booking/${trip.id}?adults=${adults}&children=${children}&infants=${infants}`;
    }

    if (!isReturnLeg) {
      // Outbound leg just picked — send the user to pick the return flight.
      const params = new URLSearchParams();
      params.set("tripType", "ROUND_TRIP");
      params.set("leg", "return");
      params.set("departingPlace", destination); // reversed direction
      params.set("destination", departingPlace); // reversed direction
      if (returnDate) params.set("departureDate", returnDate);
      if (returnDate) params.set("returnDate", returnDate);
      params.set("adults", adults);
      params.set("children", children);
      params.set("infants", infants);
      params.set("outboundTripId", trip.id.toString());
      params.set("outboundDeparture", trip.departureDateTime);
      params.set("outboundArrival", trip.arrivalDateTime);
      return `/results?${params.toString()}`;
    }

    // Return leg picked — proceed to booking, carrying the outbound reference.
    const params = new URLSearchParams();
    params.set("adults", adults);
    params.set("children", children);
    params.set("infants", infants);
    params.set("tripType", "ROUND_TRIP");
    params.set("outboundTripId", outboundTripId);
    return `/booking/${trip.id}?${params.toString()}`;
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF] text-[#16324F]">
      <section className="bg-linear-to-r from-[#1D4ED8] via-[#2563EB] to-[#60A5FA] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/"
            className="text-sm text-[#DCEEFF] transition-colors hover:text-white"
          >
            &larr; New Search
          </Link>

          {isRoundTrip && !checkingReturn && !noReturnFlights && (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#DCEEFF]">
              {isReturnLeg ? "Return flight · Step 2 of 2" : "Outbound flight · Step 1 of 2"}
            </p>
          )}

          <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            {departingPlace} to {destination}
          </h1>

          {isReturnLeg && outboundDeparture && (
            <p className="mt-1 text-sm text-[#DCEEFF]">
              Outbound selected: {destination} &rarr; {departingPlace} ·{" "}
              {new Date(outboundDeparture).toLocaleString("en-GB")}
            </p>
          )}
        </div>
      </section>

      <section className="px-6 py-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          {checkingReturn ? (
            <PlaneLoader />
          ) : noReturnFlights ? (
            <div className="rounded-2xl border border-[#DCEEFF] bg-white p-10 text-center shadow-[0_20px_40px_-15px_rgba(37,99,235,0.2)]">
              <p className="text-lg font-semibold text-[#16324F]">
                No return flights available
              </p>
              <p className="mt-2 text-[#5C7A96]">
                We couldn&apos;t find any flights from {destination} to {departingPlace}
                {returnDate && <> on {new Date(returnDate).toLocaleDateString("en-GB")}</>}.
                {returnDate
                  ? " Try a different return date."
                  : " This route currently has no scheduled return flights."}
              </p>
              <Link
                href="/"
                className="mt-6 inline-block rounded-xl bg-linear-to-r from-[#2563EB] to-[#3B82F6] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:shadow-xl"
              >
                Back to Search
              </Link>
            </div>
          ) : isLoading ? (
            <PlaneLoader />
          ) : results.length === 0 ? (
            <div className="rounded-2xl border border-[#DCEEFF] bg-white p-10 text-center shadow-[0_20px_40px_-15px_rgba(37,99,235,0.2)]">
              <p className="text-[#5C7A96]">No matching flights found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((trip) => (
                <Link
                  key={trip.id}
                  href={getTripHref(trip)}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-[#DCEEFF] bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:border-[#2563EB] hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.35)] md:flex-row md:items-center">
                  <div>
                    <p className="font-mono text-xs text-[#2563EB]">
                      {trip.plane.aircraftType}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[#16324F]">
                      {trip.departingPlace} to {trip.destination}
                    </p>
                    <p className="text-sm text-[#5C7A96]">
                      {new Date(trip.departureDateTime).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <div className="flex gap-6 text-right">
                    <div>
                      <p className="text-lg font-bold text-[#16324F]">
                        {trip.priceGuest} TND
                      </p>
                      <p className="text-xs text-[#5C7A96]">Guest class</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-[#16324F]">
                        {trip.priceBusiness} TND
                      </p>
                      <p className="text-xs text-[#5C7A96]">Business class</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!checkingReturn && !noReturnFlights && !isLoading && (
            <div className="mt-6 flex flex-col items-center gap-3">
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="rounded-xl bg-linear-to-r from-[#2563EB] to-[#3B82F6] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingMore
                    ? "Loading..."
                    : `Show ${FLIGHTS_PAGE_SIZE} more flights`}
                </button>
              )}

              {/* Only relevant when a date filter is active; hidden once dropped */}
              {departureDate && !showAllClicked && (
                <button
                  onClick={handleShowAllFlights}
                  className="rounded-xl border border-[#2563EB] bg-white px-5 py-2 text-sm font-medium text-[#2563EB] transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:bg-linear-to-r hover:from-[#2563EB] hover:to-[#3B82F6] hover:text-white hover:shadow-xl"
                >
                  Show all flights to this destination
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<PlaneLoader />}>
      <ResultsContent />
    </Suspense>
  );
}