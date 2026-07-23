// Goes in: D:\AreBook\src\app\passengers\[bookingId]\page.tsx
// (replaces the whole file)

"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Toggle from "@/components/Toggle";
import {
  PassengerForm,
  emptyPassenger,
  passengersStorageKey,
} from "@/types/passenger";

function PassengersContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const bookingId = params.bookingId as string;
  const adults = parseInt(searchParams.get("adults") || "1", 10);
  const children = parseInt(searchParams.get("children") || "0", 10);
  const seatsNeeded = adults + children;

  // Load existing data from sessionStorage if the user is coming back
  // from the Services page, otherwise start with empty passengers.
  const [passengers, setPassengers] = useState<PassengerForm[]>(() => {
    if (typeof window === "undefined") {
      return Array.from({ length: seatsNeeded }, () => emptyPassenger());
    }
    const stored = sessionStorage.getItem(passengersStorageKey(bookingId));
    if (stored) {
      try {
        const parsed: PassengerForm[] = JSON.parse(stored);
        if (parsed.length === seatsNeeded) return parsed;
      } catch {
        // fall through to fresh passengers below
      }
    }
    return Array.from({ length: seatsNeeded }, () => emptyPassenger());
  });

  // Keep sessionStorage in sync every time passenger data changes,
  // so it's always ready if the user navigates to the Services page.
  useEffect(() => {
    sessionStorage.setItem(passengersStorageKey(bookingId), JSON.stringify(passengers));
  }, [passengers, bookingId]);

  function updatePassenger(index: number, field: keyof PassengerForm, value: string | boolean) {
    setPassengers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function goToServices(index: number) {
    router.push(
      `/services/${bookingId}/${index}?adults=${adults}&children=${children}`
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF] text-[#16324F]">
      <section className="bg-linear-to-r from-[#1D4ED8] via-[#2563EB] to-[#60A5FA] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-xs tracking-[0.2em] text-[#DCEEFF]">
            BOOKING #{bookingId}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            Passenger Information — {seatsNeeded} passenger(s)
          </h1>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-3xl space-y-6">
          {passengers.map((passenger, index) => (
            <div
              key={index}
              className="rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:rounded-3xl hover:shadow-[0_20px_40px_-15px_rgba(37,99,235,0.3)]"
            >
              <h2 className="mb-4 text-lg font-semibold text-[#16324F]">
                Passenger {index + 1}
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={passenger.firstName}
                    onChange={(e) => updatePassenger(index, "firstName", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={passenger.lastName}
                    onChange={(e) => updatePassenger(index, "lastName", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    Email
                  </label>
                  <input
                    type="email"
                    value={passenger.email}
                    onChange={(e) => updatePassenger(index, "email", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={passenger.phone}
                    onChange={(e) => updatePassenger(index, "phone", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    Gender
                  </label>
                  <select
                    value={passenger.gender}
                    onChange={(e) => updatePassenger(index, "gender", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  >
                    <option value="Mr">Mr</option>
                    <option value="Mme">Mme</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={passenger.dateBirth}
                    onChange={(e) => updatePassenger(index, "dateBirth", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  />
                </div>
              </div>

              <div className="mt-6 border-t border-[#DCEEFF] pt-4">
                <Toggle
                  checked={passenger.hasDocument}
                  onChange={(value) => updatePassenger(index, "hasDocument", value)}
                  label="Add passport details (optional)"
                />

                {passenger.hasDocument && (
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                        Document Type
                      </label>
                      <select
                        value={passenger.documentType}
                        onChange={(e) => updatePassenger(index, "documentType", e.target.value)}
                        className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                      >
                        <option value="Passport">Passport</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                        Passport Number
                      </label>
                      <input
                        type="text"
                        maxLength={9}
                        value={passenger.documentNumber}
                        onChange={(e) => updatePassenger(index, "documentNumber", e.target.value)}
                        className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                        Issuing Country
                      </label>
                      <input
                        type="text"
                        value={passenger.documentCountry}
                        onChange={(e) => updatePassenger(index, "documentCountry", e.target.value)}
                        className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={passenger.documentExpiry}
                        onChange={(e) => updatePassenger(index, "documentExpiry", e.target.value)}
                        className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                      />
                    </div>
                  </div>
                )}
              </div>

              {passenger.services.length > 0 && (
                <p className="mt-4 text-xs text-[#5C7A96]">
                  {passenger.services.length} service(s) added —{" "}
                  {passenger.services.reduce((sum, s) => sum + s.price, 0)} TND
                </p>
              )}

              <button
                type="button"
                onClick={() => goToServices(index)}
                className="mt-4 w-full rounded-xl border border-[#2563EB] bg-white py-2.5 text-sm font-semibold text-[#2563EB] transition-all duration-200 hover:-translate-y-0.5 hover:rounded-2xl hover:bg-[#EAF4FF] hover:shadow-lg"
              >
                Add Services for Passenger {index + 1}
              </button>
            </div>
          ))}

          <button
            type="button"
            className="w-full rounded-xl bg-linear-to-r from-[#2563EB] to-[#3B82F6] py-3 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:rounded-2xl hover:shadow-xl"
          >
            Payment
          </button>
        </div>
      </section>
    </main>
  );
}

export default function PassengersPage() {
  return (
    <Suspense fallback={null}>
      <PassengersContent />
    </Suspense>
  );
}