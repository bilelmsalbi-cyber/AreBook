import { escapeHtml } from "./escapeHtml";

type FlightLegData = {
  departingPlace: string;
  destination: string;
  departureDateTime: string;
  aircraftType: string;
};

type PaymentConfirmationData = {
  pnr: string;
  firstName: string;
  departingPlace: string;
  destination: string;
  departureDateTime: string;
  aircraftType: string;
  totalAmount: number;
  // Only present for round-trip bookings — renders a second flight block.
  returnLeg?: FlightLegData;
};

function renderLegHtml(label: string | null, leg: FlightLegData) {
  const labelHtml = label
    ? `<p style="margin: 16px 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #2563EB; font-weight: bold;">${label}</p>`
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

export function buildPaymentConfirmationEmail(data: PaymentConfirmationData) {
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

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #16324F;">
      <div style="background: linear-gradient(90deg, #1D4ED8, #60A5FA); padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Payment Confirmed</h1>
      </div>
      <div style="padding: 24px;">
        <p>Dear ${escapeHtml(data.firstName)},</p>
        <p>Thank you for choosing AreBook. Your payment was successful and your booking is confirmed.</p>

        <div style="background: #F3F9FF; border: 1px solid #DCEEFF; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
          <p style="font-size: 12px; text-transform: uppercase; color: #5C7A96; margin: 0;">Booking Reference (PNR)</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #2563EB; margin: 8px 0 0;">
            ${data.pnr}
          </p>
        </div>

        ${legsHtml}

        <p style="margin: 16px 0 0; font-weight: bold;">Total paid: ${data.totalAmount} TND</p>

        <p style="margin-top: 24px; font-size: 13px; color: #5C7A96;">
          Please present your PNR at the airport check-in counter.
        </p>
      </div>
    </div>
  `;

  const text = `Dear ${data.firstName},

Thank you for choosing AreBook. Your payment was successful and your booking is confirmed.

Booking Reference (PNR): ${data.pnr}

${legsText}

Total paid: ${data.totalAmount} TND

Please present your PNR at the airport check-in counter.`;

  return { html, text };
}