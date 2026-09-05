"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import MyBookingsPanel from "@/components/MyBookingsPanel";

type TripType = "ONE_WAY" | "ROUND_TRIP";
type ActiveTab = "booking" | "manage";

export default function Home() {
  //
  // throw new Error("Testing error page");
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("booking");

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


  return (
    <main className="relative min-h-screen text-[#16324F]">
      {/* ==================== Full-bleed background photo ====================
          Unchanged: same photo, same crop, same overlays — only the palette
          bridging it into the card below has shifted from cool blue to warm ivory. */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[98%] w-[101%] -translate-x-1/2 -translate-y-1/2">
          <Image
            src="/plane.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: "0% 90%" }}
          />
        </div>
      </div>
      <div className="fixed inset-0 -z-10 bg-linear-to-r from-[#0B1E3D]/80 via-[#0B1E3D]/35 to-transparent" />
      <div className="fixed inset-0 -z-10 bg-linear-to-b from-transparent via-transparent to-[#FBF7EE]/95" />

      {/* ==================== Hero ==================== */}
      <section className="relative px-6 pb-28 pt-24 md:px-12 md:pt-32">
        <div className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2.5 border-b border-[#C89A5B]/60 pb-2">
            <span className="text-lg font-medium text-[#E9C98C]" style={{ fontFamily: "var(--font-display)" }}>
              AirBook
            </span>
            <span className="text-[#E9C98C]/70">·</span>
          </div>

          <h1
            className="text-4xl font-semibold leading-[1.1] tracking-tight text-white [text-shadow:0_2px_20px_rgba(11,30,61,0.75)] md:text-7xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Where next?
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#EDE3D0] [text-shadow:0_1px_8px_rgba(11,30,61,0.7)]">
            No hidden fees, no guesswork — just clear fares and a seat that&apos;s
            actually yours.
          </p>
        </div>
      </section>

      <div
        className="relative mx-auto -mb-3 h-3 max-w-5xl bg-repeat-x"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(251,247,238,0.95) 2.5px, transparent 2.5px)",
          backgroundSize: "18px 18px",
          backgroundPosition: "9px 0",
        }}
      />

      {/* ==================== Booking / Manage Card ==================== */}
      <section className="relative px-6 pb-16 md:px-12">
        <div className="mx-auto max-w-5xl rounded-2xl border border-[#EADFC7] bg-[#FFFDF8] p-6 shadow-[0_28px_56px_-24px_rgba(11,30,61,0.35)] md:p-9">
          {/* Tab bar — stays fixed regardless of which panel is shown below */}
          <div className="mb-7 flex gap-7 border-b border-[#EADFC7]">
            <button
              type="button"
              onClick={() => setActiveTab("booking")}
              className={`-mb-px pb-3 text-sm font-medium transition-colors duration-200 ${
                activeTab === "booking"
                  ? "border-b-2 border-[#B8863F] text-[#16324F]"
                  : "border-b-2 border-transparent text-[#8A93A0] hover:text-[#16324F]"
              }`}
            >
              Booking
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("manage")}
              className={`-mb-px pb-3 text-sm font-medium transition-colors duration-200 ${
                activeTab === "manage"
                  ? "border-b-2 border-[#B8863F] text-[#16324F]"
                  : "border-b-2 border-transparent text-[#8A93A0] hover:text-[#16324F]"
              }`}
            >
              Manage
            </button>
          </div>

          {activeTab === "booking" ? (
            <>
              <fieldset className="mb-7 flex gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="tripType"
                    checked={tripType === "ONE_WAY"}
                    onChange={() => setTripType("ONE_WAY")}
                    className="h-4 w-4 accent-[#B8863F]"
                  />
                  <span className="text-sm text-[#16324F]">One way</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="tripType"
                    checked={tripType === "ROUND_TRIP"}
                    onChange={() => setTripType("ROUND_TRIP")}
                    className="h-4 w-4 accent-[#B8863F]"
                  />
                  <span className="text-sm text-[#16324F]">Round trip</span>
                </label>
              </fieldset>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                 <label className="mb-2 block text-sm font-semibold text-[#16324F]">
                 From
                 </label>
                    <input
                    type="text"
                    value={departingPlace}
                    onChange={(e) => setDepartingPlace(e.target.value)}
                    placeholder="Tunis"
                     className="w-full rounded-xl border-2 border-[#DCD0BA] bg-[#FAF6EC] px-6 py-5 text-2xl font-semibold text-[#16324F] placeholder-[#B3A488] outline-none transition-all duration-200 focus:border-[#B8863F] focus:bg-white focus:shadow-[0_0_0_4px_rgba(184,134,63,0.18)]"
                 />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#16324F]">
                  To
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Paris"
                  className="w-full rounded-xl border-2 border-[#DCD0BA] bg-[#FAF6EC] px-6 py-5 text-2xl font-semibold text-[#16324F] placeholder-[#B3A488] outline-none transition-all duration-200 focus:border-[#B8863F] focus:bg-white focus:shadow-[0_0_0_4px_rgba(184,134,63,0.18)]"
                />
              </div>
            </div>
            
 

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#5C7A96]">
                    Departure date
                  </label>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full rounded-lg border border-[#E8DFCC] bg-[#FAF6EC] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:border-[#B8863F] focus:bg-white focus:shadow-[0_0_0_3px_rgba(184,134,63,0.15)]"
                  />
                </div>
                {tripType === "ROUND_TRIP" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#5C7A96]">
                      Return date
                    </label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full rounded-lg border border-[#E8DFCC] bg-[#FAF6EC] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:border-[#B8863F] focus:bg-white focus:shadow-[0_0_0_3px_rgba(184,134,63,0.15)]"
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
                className="mt-7 w-full rounded-xl border border-[#16324F] bg-[#16324F] py-3.5 font-medium text-white transition-colors duration-200 hover:border-[#B8863F] hover:bg-[#B8863F] hover:text-[#16324F]"
              >
                Search flights
              </button>
            </>
          ) : (
            <MyBookingsPanel />
          )}
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
      <label className="mb-1.5 block text-sm font-medium text-[#5C7A96]">
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-lg border border-[#E8DFCC] bg-[#FAF6EC] px-4 py-2">
        <button
          onClick={onDecrease}
          className="rounded-full px-2 text-xl text-[#B8863F] transition-colors duration-200 hover:bg-[#F3E7D0]"
        >
          -
        </button>
        <span className="flex-1 text-center text-[#16324F]">{value}</span>
        <button
          onClick={onIncrease}
          className="rounded-full px-2 text-xl text-[#B8863F] transition-colors duration-200 hover:bg-[#F3E7D0]"
        >
          +
        </button>
      </div>
    </div>
  );
}