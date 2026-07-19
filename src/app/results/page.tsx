"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PlaneLoader from "@/components/PlaneLoader";

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

function ResultsContent() {
  const searchParams = useSearchParams();

  const departingPlace = searchParams.get("departingPlace") || "";
  const destination = searchParams.get("destination") || "";
  const departureDate = searchParams.get("departureDate") || "";

  const [results, setResults] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllClicked, setShowAllClicked] = useState(false);

  useEffect(() => {
    async function fetchTrips() {
      setIsLoading(true);

      const params = new URLSearchParams();
      params.set("departingPlace", departingPlace);
      params.set("destination", destination);
      if (departureDate) params.set("departureDate", departureDate);

      const res = await fetch(`/api/flights?${params.toString()}`);
      const data = await res.json();

      setResults(Array.isArray(data) ? data : []);
      setIsLoading(false);
    }

    fetchTrips();
  }, [departingPlace, destination, departureDate]);

  async function handleShowAllFlights() {
    setIsLoading(true);

    const params = new URLSearchParams();
    params.set("departingPlace", departingPlace);
    params.set("destination", destination);
    // departureDate intentionally excluded

    const res = await fetch(`/api/flights?${params.toString()}`);
    const data = await res.json();

    setResults(Array.isArray(data) ? data : []);
    setIsLoading(false);
    setShowAllClicked(true);
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
          <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            {departingPlace} to {destination}
          </h1>
        </div>
      </section>

      <section className="px-6 py-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          {isLoading ? (
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
                  href={`/booking/${trip.id}`}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-[#DCEEFF] bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:border-[#2563EB] hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.35)] md:flex-row md:items-center"
                >
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

          {/* Always shown after any search, until clicked once */}
          {!isLoading && !showAllClicked && (
            <div className="mt-6 text-center">
              <button
                onClick={handleShowAllFlights}
                className="rounded-xl border border-[#2563EB] bg-white px-5 py-2 text-sm font-medium text-[#2563EB] transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:bg-linear-to-r hover:from-[#2563EB] hover:to-[#3B82F6] hover:text-white hover:shadow-xl"
              >
                Show all flights to this destination
              </button>
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