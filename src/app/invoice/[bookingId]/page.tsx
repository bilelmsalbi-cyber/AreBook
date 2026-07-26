"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

type BookingDetails = {
  id: number;
  seatClass: "GUEST" | "BUSINESS";
  seatsHeld: number;
  trip: {
    departingPlace: string;
    destination: string;
    departureDateTime: string;
    priceGuest: number;
    priceBusiness: number;
    plane: { aircraftType: string };
  };
  passengers: PassengerInfo[];
};

function InvoiceContent() {
  const params = useParams();
  const bookingId = params.bookingId as string;

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchBooking() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`);

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
  }, [bookingId]);

  if (fetchError) {
    throw fetchError;
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF]">
        <p className="text-[#5C7A96]">Booking not found.</p>
      </main>
    );
  }

  if (!booking) {
    return null; // loading.tsx handles this
  }

  const classPrice =
    booking.seatClass === "BUSINESS" ? booking.trip.priceBusiness : booking.trip.priceGuest;

  const seatsSubtotal = classPrice * booking.passengers.length;

  const servicesSubtotal = booking.passengers.reduce(
    (sum, p) => sum + p.specialRequests.reduce((s, r) => s + r.price, 0),
    0
  );

  const total = seatsSubtotal + servicesSubtotal;

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
            {booking.trip.departingPlace} to {booking.trip.destination} —{" "}
            {new Date(booking.trip.departureDateTime).toLocaleString("en-GB")} —{" "}
            {booking.trip.plane.aircraftType}
          </p>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-4xl space-y-6">
          {booking.passengers.map((passenger, index) => {
            const servicesTotal = passenger.specialRequests.reduce((s, r) => s + r.price, 0);
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
                    </span>
                    <span className="font-medium text-[#16324F]">{classPrice} TND</span>
                  </div>

                  {passenger.specialRequests.map((service) => (
                    <div key={service.id} className="flex justify-between text-sm">
                      <span className="text-[#5C7A96]">{service.requestType}</span>
                      <span className="font-medium text-[#16324F]">
                        {service.price === 0 ? "Free" : `${service.price} TND`}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-between border-t border-[#DCEEFF] pt-3 text-sm font-semibold">
                  <span className="text-[#16324F]">Passenger total</span>
                  <span className="text-[#16324F]">{classPrice + servicesTotal} TND</span>
                </div>
              </div>
            );
          })}

          <div className="rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)]">
            <div className="flex justify-between text-sm text-[#5C7A96]">
              <span>Seats ({booking.passengers.length})</span>
              <span>{seatsSubtotal} TND</span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-[#5C7A96]">
              <span>Services</span>
              <span>{servicesSubtotal} TND</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-[#DCEEFF] pt-3 text-xl font-bold text-[#16324F]">
              <span>Total</span>
              <span>{total} TND</span>
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