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
  requiresManualRefund: boolean;
};

type ConfirmResult = {
  bookingId: number;
  status: "CANCELLED";
  stripeRefundId: string | null;
  manualOverrideUsed: boolean;
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

// Same mount/unmount-on-demand pattern as the other cancellation
// modals. Confirmation retypes the PNR (matches the customer-facing
// modal). `role` gates the manual-override path: only ADMIN ever sees
// or can trigger it — EMPLOYEE hitting a booking with no Stripe
// payment_intent on file just sees the plain refusal, no escape hatch.
export default function AdminCancelBookingModal({
  bookingId,
  isRoundTrip,
  role,
  onClose,
  onCancelled,
}: {
  bookingId: number;
  isRoundTrip: boolean;
  role: "ADMIN" | "EMPLOYEE";
  onClose: () => void;
  onCancelled: (bookingId: number) => void;
}) {
  const [stage, setStage] = useState<Stage>("loading-preview");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pnrConfirmInput, setPnrConfirmInput] = useState("");

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

  const pnrConfirmed =
    !!breakdown?.pnr && pnrConfirmInput.trim().toUpperCase() === breakdown.pnr.toUpperCase();

  // Only ever true when the server said this booking needs it AND the
  // current caller is ADMIN — EMPLOYEE never gets this button, even if
  // requiresManualRefund came back true from the preview.
  const canUseManualOverride =
    !!breakdown?.requiresManualRefund && role === "ADMIN";

  function submitCancellation(manualOverride: boolean) {
    if (stage !== "ready" || !pnrConfirmed) return;

    setStage("confirming");
    setErrorMessage(null);

    fetch(`/api/admin/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manualOverride }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setErrorMessage(data.error || "Could not complete the cancellation.");
          setStage("confirm-error");
          return;
        }
        setConfirmResult({
          bookingId: data.bookingId,
          status: data.status,
          stripeRefundId: data.stripeRefundId ?? null,
          manualOverrideUsed: !!data.manualOverrideUsed,
        });
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

        {stage === "loading-preview" && (
          <p className="mt-4 text-sm text-[#64748B]">Loading cancellation details...</p>
        )}

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

        {(stage === "ready" || stage === "confirming" || stage === "confirm-error") &&
          breakdown && (
            <>
              {isRoundTrip && (
                <p className="mt-4 rounded-lg bg-[#0B0F19] p-3 text-xs text-[#94A3B8]">
                  This is a round-trip booking — cancelling it cancels both the outbound
                  and return flights together.
                </p>
              )}

              {breakdown.requiresManualRefund && (
                <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
                  ⚠ This booking has no Stripe payment record on file — the refund can&apos;t
                  be issued automatically.{" "}
                  {role === "ADMIN"
                    ? "As an Admin, you can confirm you've handled this manually (or that no refund is actually owed) and cancel anyway."
                    : "Only an Admin can process this cancellation."}
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
                  Type PNR <span className="font-mono">{breakdown.pnr}</span> to confirm
                </label>
                <input
                  type="text"
                  value={pnrConfirmInput}
                  onChange={(e) => setPnrConfirmInput(e.target.value)}
                  disabled={stage === "confirming"}
                  placeholder={breakdown.pnr ?? ""}
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

                {/* Normal automatic-refund path — hidden when the
                    booking requires manual handling, since it would
                    just fail with the same refusal every time. */}
                {!breakdown.requiresManualRefund && (
                  <button
                    type="button"
                    onClick={() => submitCancellation(false)}
                    disabled={stage === "confirming" || !pnrConfirmed}
                    className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-red-600 disabled:opacity-50"
                  >
                    {stage === "confirming" ? "Cancelling..." : "Confirm Cancellation"}
                  </button>
                )}

                {/* Manual override path — ADMIN only, distinctly
                    labeled so clicking it is itself an explicit,
                    unambiguous choice (in addition to the PNR retype). */}
                {breakdown.requiresManualRefund && canUseManualOverride && (
                  <button
                    type="button"
                    onClick={() => submitCancellation(true)}
                    disabled={stage === "confirming" || !pnrConfirmed}
                    className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-amber-700 disabled:opacity-50"
                  >
                    {stage === "confirming"
                      ? "Cancelling..."
                      : "Confirm Cancellation (No Automatic Refund)"}
                  </button>
                )}
              </div>
            </>
          )}

        {stage === "success" && breakdown && (
          <>
            {confirmResult?.manualOverrideUsed ? (
              <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                ✓ Booking cancelled. No Stripe refund was issued — this was recorded as a
                manual override, confirmed by you as an Admin. This action has been logged
                for audit purposes.
              </p>
            ) : confirmResult?.stripeRefundId ? (
              <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
                ✓ Refund confirmed via Stripe (ref: {confirmResult.stripeRefundId}).{" "}
                <span className="font-semibold">
                  {money(breakdown.finalRefundAmount)} TND
                </span>{" "}
                has been returned to the customer&apos;s original payment method.
              </p>
            ) : (
              <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
                ✓ Booking cancelled. No refund was due (
                {money(breakdown.finalRefundAmount)} TND).
              </p>
            )}
            <p className="mt-3 text-xs text-[#64748B]">
              A cancellation confirmation email has also been sent to the customer.
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