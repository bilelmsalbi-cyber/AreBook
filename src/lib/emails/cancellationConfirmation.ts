import { escapeHtml } from "./escapeHtml";

type FlightLegData = {
  departingPlace: string;
  destination: string;
  departureDateTime: string;
  aircraftType: string;
};

type CancellationEmailData = {
  pnr: string;
  firstName: string;
  departingPlace: string;
  destination: string;
  departureDateTime: string;
  aircraftType: string;
  // Only present for round-trip bookings — renders a second flight block.
  returnLeg?: FlightLegData;

  originalAmount: number;
  cancellationDeductionPercent: number;
  cancellationDeductionAmount: number;
  amountAfterCancellationDeduction: number;
  stripeFeeOnRefund: number;
  finalRefundAmount: number;

  // True when this cancellation was initiated from the admin dashboard
  // (by an ADMIN or EMPLOYEE) rather than by the customer/guest
  // themselves — changes the wording of the intro and closing lines so
  // the customer isn't told "as requested" for something they didn't
  // request. See executeCancellation in lib/cancellation.ts.
  cancelledByStaff?: boolean;
};

function renderLegHtml(label: string | null, leg: FlightLegData) {
  const labelHtml = label
    ? `<p style="margin: 16px 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #DC2626; font-weight: bold;">${label}</p>`
    : "";
  return `${labelHtml}
        <p style="margin: 4px 0;"><strong>${leg.departingPlace} → ${leg.destination}</strong></p>
        <p style="margin: 4px 0; color: #5C7A96;">${new Date(leg.departureDateTime).toLocaleString("en-GB")} — ${leg.aircraftType}</p>`;
}

function renderLegText(label: string | null, leg: FlightLegData) {
  const labelText = label ? `${label}\n` : "";
  return `${labelText}${leg.departingPlace} → ${leg.destination}
${new Date(leg.departureDateTime).toLocaleString("en-GB")} — ${leg.aircraftType}`;
}

export function buildCancellationEmail(data: CancellationEmailData) {
  const outbound: FlightLegData = {
    departingPlace: data.departingPlace,
    destination: data.destination,
    departureDateTime: data.departureDateTime,
    aircraftType: data.aircraftType,
  };

  const legsHtml = data.returnLeg
    ? renderLegHtml("Outbound", outbound) + renderLegHtml("Return", data.returnLeg)
    : renderLegHtml(null, outbound);

  const legsText = data.returnLeg
    ? `${renderLegText("Outbound", outbound)}\n\n${renderLegText("Return", data.returnLeg)}`
    : renderLegText(null, outbound);

  // Two distinct intro/closing pairs depending on who initiated the
  // cancellation — the customer should never read "as requested" for a
  // cancellation someone else made on their behalf.
  const introText = data.cancelledByStaff
    ? "Our team has cancelled your booking, and a refund has been issued to your original payment method."
    : "Your booking has been cancelled as requested, and a refund has been issued to your original payment method.";

  const closingText = data.cancelledByStaff
    ? "If you have any questions about this cancellation, please contact our support team — we're happy to help."
    : "Refunds are returned to your original payment method and may take a few business days to appear, depending on your bank.";

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #16324F;">
      <div style="background: linear-gradient(90deg, #DC2626, #F87171); padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Booking Cancelled</h1>
      </div>
      <div style="padding: 24px;">
        <p>Dear ${escapeHtml(data.firstName)},</p>
        <p>${introText}</p>

        <div style="background: #F3F9FF; border: 1px solid #DCEEFF; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
          <p style="font-size: 12px; text-transform: uppercase; color: #5C7A96; margin: 0;">Booking Reference (PNR)</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #DC2626; margin: 8px 0 0; text-decoration: line-through;">
            ${data.pnr}
          </p>
        </div>

        ${legsHtml}

        <div style="background: #F8FBFF; border: 1px solid #DCEEFF; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 14px;">
          <p style="display: flex; justify-content: space-between; margin: 6px 0;">
            <span>Amount paid</span><span>${data.originalAmount} TND</span>
          </p>
          <p style="display: flex; justify-content: space-between; margin: 6px 0; color: #5C7A96;">
            <span>Cancellation fee (${data.cancellationDeductionPercent}%)</span>
            <span>-${data.cancellationDeductionAmount} TND</span>
          </p>
          <p style="display: flex; justify-content: space-between; margin: 6px 0; border-top: 1px solid #DCEEFF; padding-top: 6px;">
            <span>Amount after cancellation fee</span><span>${data.amountAfterCancellationDeduction} TND</span>
          </p>
          <p style="display: flex; justify-content: space-between; margin: 6px 0; color: #5C7A96;">
            <span>Stripe processing fee</span><span>-${data.stripeFeeOnRefund} TND</span>
          </p>
          <p style="display: flex; justify-content: space-between; margin: 6px 0; border-top: 1px solid #DCEEFF; padding-top: 6px; font-weight: bold; font-size: 16px;">
            <span>Refunded to you</span><span>${data.finalRefundAmount} TND</span>
          </p>
        </div>

        <p style="margin-top: 16px; font-size: 13px; color: #5C7A96;">
          ${closingText}
        </p>
      </div>
    </div>
  `;

  const text = `Dear ${data.firstName},

${introText}

Booking Reference (PNR): ${data.pnr}

${legsText}

Amount paid: ${data.originalAmount} TND
Cancellation fee (${data.cancellationDeductionPercent}%): -${data.cancellationDeductionAmount} TND
Amount after cancellation fee: ${data.amountAfterCancellationDeduction} TND
Stripe processing fee: -${data.stripeFeeOnRefund} TND
Refunded to you: ${data.finalRefundAmount} TND

${closingText}`;

  return { html, text };
}