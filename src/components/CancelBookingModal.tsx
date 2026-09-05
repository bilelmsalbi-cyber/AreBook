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

type GuestAuth = { pnr: string; lastName: string };

function money(n: number) {
  return n.toFixed(2);
}

// Same mount/unmount-on-demand pattern as the other modals in this app:
// rendered only while a booking is selected for cancellation, so state
// always starts clean.
//
// guestAuth: when provided, sent as the request body on both the preview
// and confirm calls, so a not-logged-in customer can cancel via their
// PNR + last name — re-verified server-side on every call (see
// lib/cancellation.ts), never trusted just because /lookup succeeded
// earlier.
export default function CancelBookingModal({
  bookingId,
  isRoundTrip,
  guestAuth,
  onClose,
  onCancelled,
}: {
  bookingId: number;
  isRoundTrip: boolean;
  guestAuth?: GuestAuth;
  onClose: () => void;
  onCancelled: (bookingId: number) => void;
}) {
  const [stage, setStage] = useState<Stage>("loading-preview");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Extra safety step: the person must retype the PNR exactly before the
  // Confirm button becomes clickable — a fat-finger tap on "Cancel"
  // shouldn't be enough to actually cancel a paid booking.
  const [pnrConfirmInput, setPnrConfirmInput] = useState("");

  const requestBody = guestAuth
    ? JSON.stringify({ pnr: guestAuth.pnr, lastName: guestAuth.lastName })
    : undefined;
  const requestHeaders = guestAuth ? { "Content-Type": "application/json" } : undefined;

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/bookings/${bookingId}/cancel/preview`, {
      method: "POST",
      headers: requestHeaders,
      body: requestBody,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const pnrConfirmed =
    !!breakdown?.pnr && pnrConfirmInput.trim().toUpperCase() === breakdown.pnr.toUpperCase();

  function handleConfirm() {
    // Guards against double-submission and against confirming without
    // retyping the PNR correctly — the button is also disabled in both
    // cases, but this is the authoritative check.
    if (stage !== "ready" || !pnrConfirmed) return;

    setStage("confirming");
    setErrorMessage(null);

    fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: requestHeaders,
      body: requestBody,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#EADFC7] bg-white p-6 shadow-[0_20px_40px_-15px_rgba(11,30,61,0.25)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#16324F]">
            Cancel Booking #{bookingId}
          </h2>
          {stage !== "confirming" && (
            <button
              type="button"
              onClick={onClose}
              className="text-[#5C7A96] hover:text-[#16324F]"
            >
              ✕
            </button>
          )}
        </div>

        {/* ---- Loading the preview ---- */}
        {stage === "loading-preview" && (
          <p className="mt-4 text-sm text-[#5C7A96]">Loading cancellation details...</p>
          
        )}

        {/* ---- Preview failed to load (network error, not eligible, etc.) ---- */}
        {stage === "preview-error" && (
          <>
            <p className="mt-4 text-sm text-red-500">{errorMessage}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-lg border border-[#E8DFCC] px-4 py-2.5 text-sm font-semibold text-[#16324F] transition-all duration-200 hover:bg-[#FAF6EC]"
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
                <p className="mt-4 rounded-lg bg-[#FAF6EC] p-3 text-xs text-[#5C7A96]">
                  This is a round-trip booking — cancelling it cancels both the outbound
                  and return flights together.
                </p>
              )}

              <div className="mt-4 space-y-2 rounded-lg border border-[#EADFC7] bg-[#FAF6EC] p-4 text-sm">
                <div className="flex justify-between text-[#16324F]">
                  <span>Amount paid</span>
                  <span>{money(breakdown.originalAmount)} TND</span>
                </div>
                <div className="flex justify-between text-[#5C7A96]">
                  <span>
                    Cancellation fee ({breakdown.cancellationDeductionPercent}%)
                  </span>
                  <span>-{money(breakdown.cancellationDeductionAmount)} TND</span>
                </div>
                <div className="flex justify-between border-t border-[#EADFC7] pt-2 text-[#16324F]">
                  <span>Amount after cancellation fee</span>
                  <span>{money(breakdown.amountAfterCancellationDeduction)} TND</span>
                </div>
                <div className="flex justify-between text-[#5C7A96]">
                  <span>Stripe processing fee</span>
                  <span>-{money(breakdown.stripeFeeOnRefund)} TND</span>
                </div>
                <div className="flex justify-between border-t border-[#EADFC7] pt-2 text-base font-semibold text-[#16324F]">
                  <span>You will receive</span>
                  <span>{money(breakdown.finalRefundAmount)} TND</span>
                </div>
              </div>

              <p className="mt-3 text-xs text-[#5C7A96]">
                Stripe, our payment processor, deducts its own transaction fee from the
                refunded amount — this is why the amount you receive is slightly less
                than the amount after the cancellation fee.
              </p>

              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-[#5C7A96]">
                  Type PNR <span className="font-mono">{breakdown.pnr}</span> to confirm
                </label>
                <input
                  type="text"
                  value={pnrConfirmInput}
                  onChange={(e) => setPnrConfirmInput(e.target.value)}
                  disabled={stage === "confirming"}
                  placeholder={breakdown.pnr ?? ""}
                  className="w-full rounded-lg border border-[#E8DFCC] bg-[#FAF6EC] px-4 py-2.5 text-sm text-[#16324F] outline-none transition-all duration-200 focus:border-[#B8863F] focus:bg-white disabled:opacity-60"
                />
              </div>

              {stage === "confirm-error" && (
                <p className="mt-3 text-sm text-red-500">{errorMessage}</p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={stage === "confirming"}
                  className="flex-1 rounded-lg border border-[#E8DFCC] px-4 py-2.5 text-sm font-semibold text-[#16324F] transition-all duration-200 hover:bg-[#FAF6EC] disabled:opacity-50"
                >
                  Keep Booking
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={stage === "confirming" || !pnrConfirmed}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-red-600 disabled:opacity-50"
                >
                  {stage === "confirming" ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </>
          )}

        {/* ---- Success ---- */}
        {stage === "success" && breakdown && (
          <>
            <p className="mt-4 text-sm text-[#16324F]">
              Your booking has been cancelled. A refund of{" "}
              <span className="font-semibold">{money(breakdown.finalRefundAmount)} TND</span>{" "}
              is on its way back to your original payment method.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-lg bg-linear-to-r from-[#B8863F] to-[#C89A5B] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-[#A97535] hover:to-[#B8863F]"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}