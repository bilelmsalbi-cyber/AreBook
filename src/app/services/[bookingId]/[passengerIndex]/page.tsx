"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  PassengerForm,
  SelectedService,
  passengersStorageKey,
} from "@/types/passenger";
import PlaneLoader from "@/components/PlaneLoader";
import Image from "next/image";

type ServicePriceInfo = { label: string; price: number; maxQuantity: number | null };
type ServicePricesResponse = Record<"WHEELCHAIR" | "MEAL" | "BAGGAGE" | "PET", ServicePriceInfo>;

function ServicesContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const bookingId = params.bookingId as string;
  const passengerIndex = parseInt(params.passengerIndex as string, 10);
  const adults = searchParams.get("adults") || "1";
  const children = searchParams.get("children") || "0";
  // Doesn't call the booking-detail endpoint itself, but must carry the
  // token back to the passengers page when returning there (see
  // handleAddServices below) — otherwise the guest would lose access on
  // the way back.
  const token = searchParams.get("token") || "";

  // Prices now live in the database — fetched once on mount instead of
  // imported as static constants, so admin changes take effect immediately.
  const [prices, setPrices] = useState<ServicePricesResponse | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch("/api/pricing/services");
        if (!res.ok) {
          throw new Error(`Failed to fetch service prices (status ${res.status})`);
        }
        const data = await res.json();
        setPrices(data);
      } catch (err) {
        setFetchError(err instanceof Error ? err : new Error("Unknown error"));
      }
    }
    fetchPrices();
  }, []);

  if (fetchError) {
    throw fetchError;
  }

  function getExistingServices(): SelectedService[] {
    const stored = sessionStorage.getItem(passengersStorageKey(bookingId));
    if (!stored) return [];
    try {
      const parsed: PassengerForm[] = JSON.parse(stored);
      return parsed[passengerIndex]?.services || [];
    } catch {
      return [];
    }
  }

  const existingServices = getExistingServices();
  const existingPet = existingServices.find((s) => s.type === "PET");
  const existingBag = existingServices.find((s) => s.type === "BAGGAGE");

  const [wheelchair, setWheelchair] = useState(
    () => !!existingServices.find((s) => s.type === "WHEELCHAIR")
  );
  const [meal, setMeal] = useState(
    () => !!existingServices.find((s) => s.type === "MEAL")
  );
  const [bagCount, setBagCount] = useState(() => existingBag?.quantity || 0);
  const [petType, setPetType] = useState(() => existingPet?.petType || "");
  const [petWeight, setPetWeight] = useState(() =>
    existingPet?.petWeight ? String(existingPet.petWeight) : ""
  );
  const [petSelected, setPetSelected] = useState(() => !!existingPet);

  // Not ready to render the form until prices have loaded — every price
  // shown below depends on them.
  if (!prices) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-white via-[#FBF7EE] to-[#F3E7D0]">
        <PlaneLoader />
      </main>
    );
  }

  const BAG_PRICE = prices.BAGGAGE.price;
  const MAX_BAGS = prices.BAGGAGE.maxQuantity ?? 3;
  const MEAL_PRICE = prices.MEAL.price;
  const PET_PRICE_PER_KG = prices.PET.price;

  const petPrice = petType && petWeight ? parseFloat(petWeight) * PET_PRICE_PER_KG : 0;

  function handleAddServices() {
    const services: SelectedService[] = [];

    if (wheelchair) {
      services.push({ type: "WHEELCHAIR", label: prices!.WHEELCHAIR.label, price: 0 });
    }
    if (meal) {
      services.push({ type: "MEAL", label: prices!.MEAL.label, price: MEAL_PRICE });
    }
    if (bagCount > 0) {
      services.push({
        type: "BAGGAGE",
        label: `${prices!.BAGGAGE.label} x${bagCount}`,
        price: bagCount * BAG_PRICE,
        quantity: bagCount,
      });
    }
    if (petSelected && petType && petWeight && parseFloat(petWeight) > 0) {
      const w = parseFloat(petWeight);
      services.push({
        type: "PET",
        label: `${prices!.PET.label} (${petType}, ${w}kg)`,
        price: w * PET_PRICE_PER_KG,
        petType,
        petWeight: w,
      });
    }

    const stored = sessionStorage.getItem(passengersStorageKey(bookingId));
    const parsed: PassengerForm[] = stored ? JSON.parse(stored) : [];
    parsed[passengerIndex] = { ...parsed[passengerIndex], services };
    sessionStorage.setItem(passengersStorageKey(bookingId), JSON.stringify(parsed));

    router.push(`/passengers/${bookingId}?adults=${adults}&children=${children}&token=${token}`);
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-white via-[#FBF7EE] to-[#F3E7D0] text-[#16324F]">
      <section className="bg-linear-to-r from-[#0B1E3D] via-[#16324F] to-[#2C4A6E] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-xs tracking-[0.2em] text-[#EADFC7]">
            BOOKING #{bookingId}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Add Services — Passenger {passengerIndex + 1}
          </h1>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-4xl space-y-10">
          {/* ==================== Premium Services ==================== */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-[#16324F]">Premium Services</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Extra Baggage */}
              <div className="rounded-2xl border border-[#EADFC7] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(11,30,61,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:rounded-3xl hover:shadow-[0_20px_40px_-15px_rgba(11,30,61,0.3)]">
                <div className="relative h-49 w-full overflow-hidden rounded-xl bg-[#FBF7EE]">
                  <Image src="/services/baggage.jpg" alt="" fill sizes="400px" className="object-cover" />
                </div>
                <h3 className="mt-4 text-base font-bold text-[#16324F]">Extra Baggage (20kg)</h3>
                <p className="mt-2 text-2xl font-bold text-[#16324F]">{bagCount * BAG_PRICE} TND</p>
                <p className="mt-1 text-sm text-[#5C7A96]">
                  Add up to {MAX_BAGS} extra checked bags, 20kg each.
                </p>
                <div className="mt-4 flex items-center justify-center gap-4 rounded-lg border border-[#E8DFCC] bg-[#FAF6EC] px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setBagCount((n) => Math.max(0, n - 1))}
                    className="rounded-full px-2 text-xl text-[#B8863F] transition-all duration-200 hover:scale-110 hover:bg-[#EADFC7]"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center text-[#16324F]">{bagCount}</span>
                  <button
                    type="button"
                    onClick={() => setBagCount((n) => Math.min(MAX_BAGS, n + 1))}
                    className="rounded-full px-2 text-xl text-[#B8863F] transition-all duration-200 hover:scale-110 hover:bg-[#EADFC7]"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Pet Travel */}
              <div className="rounded-2xl border border-[#EADFC7] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(11,30,61,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:rounded-3xl hover:shadow-[0_20px_40px_-15px_rgba(11,30,61,0.3)]">
                <div className="relative h-49 w-full overflow-hidden rounded-xl bg-[#FBF7EE]">
                  <Image src="/services/pet.jpg" alt="" fill sizes="400px" className="object-cover" />
                </div>
                <h3 className="mt-4 text-base font-bold text-[#16324F]">Travel with a Pet</h3>
                <p className="mt-1 text-sm text-[#5C7A96]">{PET_PRICE_PER_KG} TND per kg</p>

                <div className="mt-4 space-y-3">
                  <select
                    value={petType}
                    onChange={(e) => setPetType(e.target.value)}
                    className="w-full rounded-lg border border-[#E8DFCC] bg-[#FAF6EC] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:border-[#B8863F] focus:bg-white"
                  >
                    <option value="">Select animal</option>
                    <option value="Cat">Cat</option>
                    <option value="Dog">Dog</option>
                    <option value="Hamster">Hamster</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    placeholder="Weight (kg, max 10)"
                    value={petWeight}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setPetWeight("");
                        return;
                      }
                      const clamped = Math.min(10, Math.max(0, Number(raw)));
                      setPetWeight(String(clamped));
                    }}
                    className="w-full rounded-lg border border-[#E8DFCC] bg-[#FAF6EC] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:border-[#B8863F] focus:bg-white"
                  />
                </div>

                {petType && petWeight && parseFloat(petWeight) > 0 && (
                  <p className="mt-3 text-2xl font-bold text-[#16324F]">
                    {petPrice.toFixed(2)} TND
                  </p>
                )}

                <button
                  type="button"
                  disabled={!petType || !petWeight || parseFloat(petWeight) <= 0}
                  onClick={() => setPetSelected((v) => !v)}
                  className={
                    !petType || !petWeight || parseFloat(petWeight) <= 0
                      ? "mt-4 w-full cursor-not-allowed rounded-xl bg-gray-200 py-2.5 text-sm font-semibold text-gray-400"
                      : petSelected
                      ? "mt-4 w-full rounded-xl bg-gray-300 py-2.5 text-sm font-semibold text-gray-600"
                      : "mt-4 w-full rounded-xl border border-[#B8863F] bg-white py-2.5 text-sm font-semibold text-[#B8863F] transition-all duration-200 hover:-translate-y-0.5 hover:rounded-2xl hover:bg-[#FBF7EE] hover:shadow-lg"
                  }
                >
                  {petSelected ? "Selected" : "Select"}
                </button>
              </div>
            </div>
          </div>

          {/* ==================== Special Services ==================== */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-[#16324F]">Special Services</h2>
            <div className="flex flex-col overflow-hidden rounded-2xl border border-[#EADFC7] bg-white shadow-[0_15px_35px_-15px_rgba(11,30,61,0.2)] md:flex-row">
              {/* Wheelchair */}
              <div className="flex-1 p-6 md:border-r md:border-[#EADFC7]">
                <div className="relative h-49 w-full overflow-hidden rounded-xl bg-[#FBF7EE]">
                  <Image src="/services/wheelchair.jpg" alt="" fill sizes="400px" className="object-cover" />
                </div>
                <h3 className="mt-4 text-base font-bold text-[#16324F]">Wheelchair Assistance</h3>
                <p className="mt-2 text-2xl font-bold text-[#16324F]">Free</p>
                <p className="mt-1 text-sm text-[#5C7A96]">
                  Assistance getting to and boarding the aircraft.
                </p>
                <button
                  type="button"
                  onClick={() => setWheelchair((v) => !v)}
                  className={
                    wheelchair
                      ? "mt-4 w-full rounded-xl bg-gray-300 py-2.5 text-sm font-semibold text-gray-600"
                      : "mt-4 w-full rounded-xl border border-[#B8863F] bg-white py-2.5 text-sm font-semibold text-[#B8863F] transition-all duration-200 hover:-translate-y-0.5 hover:rounded-2xl hover:bg-[#FBF7EE] hover:shadow-lg"
                  }
                >
                  {wheelchair ? "Selected" : "Select"}
                </button>
              </div>

              {/* Special Meal */}
              <div className="flex-1 p-6">
                <div className="relative h-49 w-full overflow-hidden rounded-xl bg-[#FBF7EE]">
                  <Image src="/services/meal.jpg" alt="" fill sizes="400px" className="object-cover" />
                </div>
                <h3 className="mt-4 text-base font-bold text-[#16324F]">Special Meal</h3>
                <p className="mt-2 text-2xl font-bold text-[#16324F]">{MEAL_PRICE} TND</p>
                <p className="mt-1 text-sm text-[#5C7A96]">
                  Special dietary meal (e.g. gluten-free) served during the flight.
                </p>
                <button
                  type="button"
                  onClick={() => setMeal((v) => !v)}
                  className={
                    meal
                      ? "mt-4 w-full rounded-xl bg-gray-300 py-2.5 text-sm font-semibold text-gray-600"
                      : "mt-4 w-full rounded-xl border border-[#B8863F] bg-white py-2.5 text-sm font-semibold text-[#B8863F] transition-all duration-200 hover:-translate-y-0.5 hover:rounded-2xl hover:bg-[#FBF7EE] hover:shadow-lg"
                  }
                >
                  {meal ? "Selected" : "Select"}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddServices}
            className="w-full rounded-xl bg-linear-to-r from-[#B8863F] to-[#C89A5B] py-3.5 font-semibold text-white transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:shadow-xl"
          >
            Add Selected Services
          </button>
        </div>
      </section>
    </main>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={null}>
      <ServicesContent />
    </Suspense>
  );
}