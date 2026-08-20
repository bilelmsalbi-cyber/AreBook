"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type TripType = "ONE_WAY" | "ROUND_TRIP";

export default function Home() {
  //
  // throw new Error("Testing error page");
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

    if (tripType === "ROUND_TRIP" && departureDate && returnDate && returnDate < departureDate) {
      setValidationError("Return date cannot be before the departure date.");
      return;
    }

    setValidationError("");

    const params = new URLSearchParams();
    params.set("tripType", tripType);
    params.set("departingPlace", departingPlace);
    params.set("destination", destination);
    if (departureDate) params.set("departureDate", departureDate);
    if (tripType === "ROUND_TRIP" && returnDate) params.set("returnDate", returnDate);
    params.set("adults", adults.toString());
    params.set("children", children.toString());
    params.set("infants", infants.toString());

    router.push(`/results?${params.toString()}`);
  }

  const totalPassengers = infants + children + adults;

  return (
    <main className="relative min-h-screen text-[#16324F]">
      {/* ==================== Full-bleed background photo ====================
          Covers the hero strip AND the area behind the white search card. */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[98%] w-[101%] -translate-x-1/2 -translate-y-1/2">
          <Image
            src="/plane.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: "100% 93%" }}
          />
        </div>
      </div>
      <div className="fixed inset-0 -z-10 bg-linear-to-r from-[#0B1E3D]/80 via-[#0B1E3D]/35 to-transparent" />
      <div className="fixed inset-0 -z-10 bg-linear-to-b from-transparent via-transparent to-[#EAF3FF]/95" />

      {/* ==================== Hero ==================== */}
      <section className="relative px-6 pb-28 pt-24 md:px-12 md:pt-32">
        <div className="max-w-xl">
          <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 font-mono text-xs tracking-[0.2em] text-white backdrop-blur-sm">
            <span>ANYWHERE</span>
            <span className="text-white/50">✈</span>
            <span>EVERYWHERE</span>
            <span className="mx-1 h-3 w-px bg-white/30" />
            <span className="text-white/70">AREBOOK</span>
          </div>

          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white [text-shadow:0_2px_16px_rgba(11,30,61,0.7)] md:text-6xl">
            Fly on your terms.
          </h1>
          <p className="mt-4 max-w-md text-[#DCEEFF] [text-shadow:0_1px_8px_rgba(11,30,61,0.7)]">
            No hidden fees, no guesswork — just clear fares and a seat that&apos;s
            actually yours.
          </p>
        </div>
      </section>

      
      <div
        className="relative mx-auto -mb-3 h-3 max-w-5xl bg-repeat-x"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.9) 2.5px, transparent 2.5px)",
          backgroundSize: "18px 18px",
          backgroundPosition: "9px 0",
        }}
      />

      {/* ==================== Search Form ==================== */}
      <section className="relative px-6 pb-16 md:px-12">
        <div className="mx-auto max-w-5xl rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_20px_40px_-15px_rgba(37,99,235,0.25)] md:p-8">
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