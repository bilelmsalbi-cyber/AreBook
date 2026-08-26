"use client";

import { useEffect, useState } from "react";

type Breakdown = {
  bookingId: number;
  pnr: string | null;
  originalAmount: number;
  cancellationDeductionPercent: number;
  cancellationDeductionAmount: number;
  amountAfterCancellationDeduction: number;
  stripeFeeOnRefund: number;
  finalRefundAmount: number;
};

type Stage =
  | "loading-preview"
  | "preview-error"
  | "ready"
  | "confirming"
  | "confirm-error"
  | "success";

function money(n: number) {
  return n.toFixed(2);
}

// Same mount/unmount-on-demand pattern as PassengersModal and the
// customer-facing CancelBookingModal: rendered only while a booking is
// selected for cancellation, so state always starts clean.
//
// Confirmation step retypes the booking ID (not the PNR) — unlike the
// customer flow, this is the identifier the admin dashboard searches
// and displays by everywhere, and it's always present even before the
// round-trip pnr bug fix era's edge cases.
//
// No ownership restrictions apply here (see verifyOwnership's "admin"
// branch in lib/cancellation.ts) — any Admin or Employee can cancel any
// eligible booking. Employees are capped by refund amount server-side;
// if that cap is exceeded, the preview call below surfaces the server's
// error message directly (e.g. "ask an Admin to process this").
export default function AdminCancelBookingModal({
  bookingId,
  isRoundTrip,
  onClose,
  onCancelled,
}: {
  bookingId: number;
  isRoundTrip: boolean;
  onClose: () => void;
  onCancelled: (bookingId: number) => void;
}) {
  const [stage, setStage] = useState<Stage>("loading-preview");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Extra safety step: must retype the booking ID exactly before the
  // Confirm button becomes clickable — a fat-finger tap shouldn't be
  // enough to actually cancel a paid booking, same rationale as the
  // customer-facing modal's PNR retype.
  const [idConfirmInput, setIdConfirmInput] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/bookings/${bookingId}/cancel/preview`, {
      method: "POST",
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setErrorMessage(data.error || "Could not load cancellation details.");
          setStage("preview-error");
          return;
        }
        setBreakdown(data);
        setStage("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMessage("Could not load cancellation details. Please check your connection.");
        setStage("preview-error");
      });

    return () => {
      cancelled = true;
    };
    // .eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const idConfirmed = idConfirmInput.trim() === String(bookingId);

  function handleConfirm() {
    if (stage !== "ready" || !idConfirmed) return;

    setStage("confirming");
    setErrorMessage(null);

    fetch(`/api/admin/bookings/${bookingId}/cancel`, {
      method: "POST",
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setErrorMessage(data.error || "Could not complete the cancellation.");
          setStage("confirm-error");
          return;
        }
        setStage("success");
        onCancelled(bookingId);
      })
      .catch(() => {
        setErrorMessage("Could not complete the cancellation. Please check your connection and try again.");
        setStage("confirm-error");
      });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Cancel Booking #{bookingId}
          </h2>
          {stage !== "confirming" && (
            <button
              type="button"
              onClick={onClose}
              className="text-[#64748B] hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* ---- Loading the preview ---- */}
        {stage === "loading-preview" && (
          <p className="mt-4 text-sm text-[#64748B]">Loading cancellation details...</p>
        )}

        {/* ---- Preview failed to load (not eligible, over employee limit, network error, etc.) ---- */}
        {stage === "preview-error" && (
          <>
            <p className="mt-4 text-sm text-red-400">{errorMessage}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-lg border border-[#1E293B] px-4 py-2.5 text-sm font-semibold text-[#94A3B8] transition-colors duration-150 hover:text-white"
            >
              Close
            </button>
          </>
        )}

        {/* ---- Ready to confirm, or confirming, or confirm failed ---- */}
        {(stage === "ready" || stage === "confirming" || stage === "confirm-error") &&
          breakdown && (
            <>
              {isRoundTrip && (
                <p className="mt-4 rounded-lg bg-[#0B0F19] p-3 text-xs text-[#94A3B8]">
                  This is a round-trip booking — cancelling it cancels both the outbound
                  and return flights together.
                </p>
              )}

              <div className="mt-4 space-y-2 rounded-lg border border-[#1E293B] bg-[#0B0F19] p-4 text-sm">
                <div className="flex justify-between text-white">
                  <span>Amount paid</span>
                  <span>{money(breakdown.originalAmount)} TND</span>
                </div>
                <div className="flex justify-between text-[#94A3B8]">
                  <span>
                    Cancellation fee ({breakdown.cancellationDeductionPercent}%)
                  </span>
                  <span>-{money(breakdown.cancellationDeductionAmount)} TND</span>
                </div>
                <div className="flex justify-between border-t border-[#1E293B] pt-2 text-white">
                  <span>Amount after cancellation fee</span>
                  <span>{money(breakdown.amountAfterCancellationDeduction)} TND</span>
                </div>
                <div className="flex justify-between text-[#94A3B8]">
                  <span>Stripe processing fee</span>
                  <span>-{money(breakdown.stripeFeeOnRefund)} TND</span>
                </div>
                <div className="flex justify-between border-t border-[#1E293B] pt-2 text-base font-semibold text-white">
                  <span>Customer will receive</span>
                  <span>{money(breakdown.finalRefundAmount)} TND</span>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
                  Type booking ID <span className="font-mono">{bookingId}</span> to confirm
                </label>
                <input
                  type="text"
                  value={idConfirmInput}
                  onChange={(e) => setIdConfirmInput(e.target.value)}
                  disabled={stage === "confirming"}
                  placeholder={String(bookingId)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none transition-colors duration-150 focus:border-[#3B82F6] disabled:opacity-60"
                />
              </div>

              {stage === "confirm-error" && (
                <p className="mt-3 text-sm text-red-400">{errorMessage}</p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={stage === "confirming"}
                  className="flex-1 rounded-lg border border-[#1E293B] px-4 py-2.5 text-sm font-semibold text-[#94A3B8] transition-colors duration-150 hover:text-white disabled:opacity-50"
                >
                  Keep Booking
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={stage === "confirming" || !idConfirmed}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-red-600 disabled:opacity-50"
                >
                  {stage === "confirming" ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </>
          )}

        {/* ---- Success ---- */}
        {stage === "success" && breakdown && (
          <>
            <p className="mt-4 text-sm text-[#CBD5E1]">
              Booking cancelled. A refund of{" "}
              <span className="font-semibold text-white">
                {money(breakdown.finalRefundAmount)} TND
              </span>{" "}
              is on its way back to the customer&apos;s original payment method.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#2563EB]"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}