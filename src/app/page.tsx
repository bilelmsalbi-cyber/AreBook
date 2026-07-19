"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TripType = "ONE_WAY" | "ROUND_TRIP";

export default function Home() {
  const router = useRouter();

  const [tripType, setTripType] = useState<TripType>("ONE_WAY");
  const [departingPlace, setDepartingPlace] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");

  const [infants, setInfants] = useState(0);
  const [children, setChildren] = useState(0);
  const [adults, setAdults] = useState(1);

  const [validationError, setValidationError] = useState("");

  function handleSearch() {
    if (!departingPlace.trim() || !destination.trim()) {
      setValidationError("Please enter both a departure place and a destination.");
      return;
    }

    setValidationError("");

    const params = new URLSearchParams();
    params.set("departingPlace", departingPlace);
    params.set("destination", destination);
    if (departureDate) params.set("departureDate", departureDate);

    router.push(`/results?${params.toString()}`);
  }

  const totalPassengers = infants + children + adults;

  return (
    <main className="min-h-screen bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF] text-[#16324F]">
      {/* ==================== Hero ==================== */}
      <section className="bg-linear-to-r from-[#1D4ED8] via-[#2563EB] to-[#60A5FA] px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 font-mono text-xs tracking-[0.3em] text-[#DCEEFF]">
            AREBOOK — DEPARTURES
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">
            Where do you want to fly?
          </h1>
          <p className="mt-3 max-w-xl text-[#DCEEFF]">
            Find your flight, choose your class, and book with ease.
          </p>
        </div>
      </section>

      {/* ==================== Search Form ==================== */}
      <section className="px-6 py-8 md:px-12">
        <div className="mx-auto -mt-10 max-w-5xl rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_20px_40px_-15px_rgba(37,99,235,0.25)] md:p-8">
          <fieldset className="mb-6 flex gap-6">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="tripType"
                checked={tripType === "ONE_WAY"}
                onChange={() => setTripType("ONE_WAY")}
                className="h-4 w-4 accent-[#2563EB]"
              />
              <span className="text-sm text-[#16324F]">One Way</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="tripType"
                checked={tripType === "ROUND_TRIP"}
                onChange={() => setTripType("ROUND_TRIP")}
                className="h-4 w-4 accent-[#2563EB]"
              />
              <span className="text-sm text-[#16324F]">Round Trip</span>
            </label>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                From
              </label>
              <input
                type="text"
                value={departingPlace}
                onChange={(e) => setDepartingPlace(e.target.value)}
                placeholder="Tunis"
                className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] placeholder-[#9DB6CF] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                To
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Paris"
                className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] placeholder-[#9DB6CF] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                Departure Date
              </label>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
              />
            </div>
            {tripType === "ROUND_TRIP" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                  Return Date
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                />
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <PassengerCounter
              label="Adults (12+)"
              value={adults}
              onDecrease={() => setAdults((n) => Math.max(1, n - 1))}
              onIncrease={() => setAdults((n) => n + 1)}
            />
            <PassengerCounter
              label="Children (2-11)"
              value={children}
              onDecrease={() => setChildren((n) => Math.max(0, n - 1))}
              onIncrease={() => setChildren((n) => n + 1)}
            />
            <PassengerCounter
              label="Infants (<2)"
              value={infants}
              onDecrease={() => setInfants((n) => Math.max(0, n - 1))}
              onIncrease={() => setInfants((n) => n + 1)}
            />
          </div>

          {validationError && (
            <p className="mt-4 text-sm text-red-500">{validationError}</p>
          )}

          <button
            onClick={handleSearch}
            className="mt-6 w-full rounded-xl bg-linear-to-r from-[#2563EB] to-[#3B82F6] py-3.5 font-semibold text-white transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:from-[#1D4ED8] hover:to-[#2563EB] hover:shadow-xl"
          >
            {`Search Flights - ${totalPassengers} passenger(s)`}
          </button>
        </div>
      </section>
    </main>
  );
}

function PassengerCounter({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-2">
        <button
          onClick={onDecrease}
          className="rounded-full px-2 text-xl text-[#2563EB] transition-all duration-200 hover:scale-110 hover:bg-[#DCEEFF]"
        >
          -
        </button>
        <span className="flex-1 text-center text-[#16324F]">{value}</span>
        <button
          onClick={onIncrease}
          className="rounded-full px-2 text-xl text-[#2563EB] transition-all duration-200 hover:scale-110 hover:bg-[#DCEEFF]"
        >
          +
        </button>
      </div>
    </div>
  );
}