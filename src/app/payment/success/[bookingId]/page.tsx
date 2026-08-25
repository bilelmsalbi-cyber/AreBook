"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

type TripInfo = {
  departingPlace: string;
  destination: string;
  departureDateTime: string;
  plane: { aircraftType: string };
};

type BookingStatus = {
  id: number;
  status: string;
  pnr: string | null;
  tripType: string;
  trip: TripInfo;
  passengers: { person: { firstName: string; lastName: string } }[];
  // Present only for round-trip bookings. Carries no pnr of its own —
  // the pair shares the outbound leg's pnr (see webhooks/stripe/route.ts).
  linkedBooking: {
    trip: TripInfo;
  } | null;
};

function SuccessContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingId = params.bookingId as string;
  // Guest access token forwarded all the way from pay/route.ts's Stripe
  // success_url — required to view this booking before it's linked to
  // any session (see api/bookings/[id]/route.ts).
  const token = searchParams.get("token") || "";

  const [booking, setBooking] = useState<BookingStatus | null>(null);
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 8;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const res = await fetch(`/api/bookings/${bookingId}?token=${token}`);
      if (!res.ok) return;
      const data = await res.json();
      if (cancelled) return;

      // A round-trip's return leg has no pnr of its own — resolve it via
      // the linked (outbound) leg, same as everywhere else in the app.
      const resolvedPnr = data.pnr ?? data.linkedBooking?.pnr ?? null;

      if (data.status === "CONFIRMED" && resolvedPnr) {
        setBooking({ ...data, pnr: resolvedPnr });
      } else if (attempts < maxAttempts) {
        setTimeout(() => setAttempts((a) => a + 1), 1500);
      }
    }
    poll();

    return () => {
      cancelled = true;
    };
  }, [bookingId, token, attempts]);

  if (!booking) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF] text-[#16324F]">
        <p className="text-sm text-[#5C7A96]">Confirming your payment…</p>
      </main>
    );
  }

  const returnLeg = booking.linkedBooking;

  return (
    <main className="min-h-screen bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF] text-[#16324F]">
      <section className="bg-linear-to-r from-[#1D4ED8] via-[#2563EB] to-[#60A5FA] px-6 py-10 md:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#DCEEFF]">
            Payment Successful
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Your booking is confirmed</h1>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-md space-y-6">
          <div className="rounded-2xl border border-[#DCEEFF] bg-white p-8 text-center shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)]">
            <p className="text-xs uppercase tracking-widest text-[#5C7A96]">
              Booking Reference (PNR)
              {returnLeg && " — covers both flights"}
            </p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-[#2563EB]">
              {booking.pnr}
            </p>
            <p className="mt-3 text-xs text-[#5C7A96]">
              Present this code at the airport check-in counter.
            </p>

            <p className="mt-3 text-xs text-[#5C7A96]">
              We have sent a confirmation email to your inbox.
            </p>
          </div>

          <div className="rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)]">
            <p className="text-sm font-semibold text-[#16324F]">
              {returnLeg ? "Outbound: " : ""}
              {booking.trip.departingPlace} → {booking.trip.destination}
            </p>
            <p className="mt-1 text-sm text-[#5C7A96]">
              {new Date(booking.trip.departureDateTime).toLocaleString("en-GB")} —{" "}
              {booking.trip.plane.aircraftType}
            </p>

            {returnLeg && (
              <>
                <p className="mt-3 text-sm font-semibold text-[#16324F]">
                  Return: {returnLeg.trip.departingPlace} → {returnLeg.trip.destination}
                </p>
                <p className="mt-1 text-sm text-[#5C7A96]">
                  {new Date(returnLeg.trip.departureDateTime).toLocaleString("en-GB")} —{" "}
                  {returnLeg.trip.plane.aircraftType}
                </p>
              </>
            )}

            <div className="mt-4 space-y-1 border-t border-[#DCEEFF] pt-4">
              {booking.passengers.map((p, i) => (
                <p key={i} className="text-sm text-[#16324F]">
                  {p.person.firstName} {p.person.lastName}
                </p>
              ))}
            </div>
          </div>

          <Link
            href={`/invoice/${bookingId}?token=${token}`}
            className="block w-full rounded-xl border border-[#2563EB] py-3 text-center text-sm font-semibold text-[#2563EB] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#EAF4FF]"
          >
            View Full Invoice
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}