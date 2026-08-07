"use client";

import { useEffect, useState } from "react";
import type { PassengerDetail } from "@/types/booking";

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Rendered by BookingsManager only while a booking is selected — same
// mount/unmount-on-demand pattern used by MaintenanceModal, so state
// always starts clean with no manual reset needed.
export default function PassengersModal({
  bookingId,
  onClose,
}: {
  bookingId: number;
  onClose: () => void;
}) {
  const [passengers, setPassengers] = useState<PassengerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/bookings/${bookingId}/passengers`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setError(data.error || "Failed to load passengers.");
          return;
        }
        setPassengers(data.passengers);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load passengers.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Passengers — Booking #{bookingId}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748B] hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 max-h-112 space-y-3 overflow-y-auto">
          {loading && <p className="text-sm text-[#64748B]">Loading...</p>}

          {!loading && error && <p className="text-sm text-red-400">{error}</p>}

          {!loading && !error && passengers.length === 0 && (
            <p className="text-sm text-[#64748B]">
              No passengers found for this booking.
            </p>
          )}

          {!loading &&
            !error &&
            passengers.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-[#1E293B] bg-[#0B0F19] p-4"
              >
                <p className="text-sm font-semibold text-white">
                  {p.person.firstName} {p.person.lastName}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
                  <p>Email: {p.person.email}</p>
                  <p>Phone: {p.person.phone}</p>
                  <p>Gender: {p.person.gender}</p>
                  <p>Date of Birth: {formatDate(p.person.dateBirth)}</p>
                </div>

                <div className="mt-3 border-t border-[#1E293B] pt-3">
                  <p className="text-xs font-medium text-[#64748B]">
                    Travel Document
                  </p>
                  {p.document ? (
                    <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
                      <p>Type: {p.document.documentType}</p>
                      <p>Number: {p.document.number}</p>
                      <p>Country: {p.document.country}</p>
                      <p>Expires: {formatDate(p.document.expiryDate)}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-[#64748B]">
                      No document on file.
                    </p>
                  )}
                </div>

                {p.specialRequests.length > 0 && (
                  <div className="mt-3 border-t border-[#1E293B] pt-3">
                    <p className="text-xs font-medium text-[#64748B]">
                      Special Requests
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-[#94A3B8]">
                      {p.specialRequests.map((r) => (
                        <li key={r.id}>
                          {r.requestType} — {r.price} TND
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}