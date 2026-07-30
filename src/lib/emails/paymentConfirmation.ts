type PaymentConfirmationData = {
  pnr: string;
  firstName: string;
  departingPlace: string;
  destination: string;
  departureDateTime: string;
  aircraftType: string;
  totalAmount: number;
};

export function buildPaymentConfirmationEmail(data: PaymentConfirmationData) {
  const formattedDate = new Date(data.departureDateTime).toLocaleString("en-GB");

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #16324F;">
      <div style="background: linear-gradient(90deg, #1D4ED8, #60A5FA); padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Payment Confirmed</h1>
      </div>
      <div style="padding: 24px;">
        <p>Dear ${data.firstName},</p>
        <p>Thank you for choosing AreBook. Your payment was successful and your booking is confirmed.</p>

        <div style="background: #F3F9FF; border: 1px solid #DCEEFF; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
          <p style="font-size: 12px; text-transform: uppercase; color: #5C7A96; margin: 0;">Booking Reference (PNR)</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #2563EB; margin: 8px 0 0;">
            ${data.pnr}
          </p>
        </div>

        <p style="margin: 4px 0;"><strong>${data.departingPlace} → ${data.destination}</strong></p>
        <p style="margin: 4px 0; color: #5C7A96;">${formattedDate} — ${data.aircraftType}</p>
        <p style="margin: 12px 0; font-weight: bold;">Total paid: ${data.totalAmount} TND</p>

        <p style="margin-top: 24px; font-size: 13px; color: #5C7A96;">
          Please present your PNR at the airport check-in counter.
        </p>
      </div>
    </div>
  `;

  const text = `Dear ${data.firstName},

Thank you for choosing AreBook. Your payment was successful and your booking is confirmed.

Booking Reference (PNR): ${data.pnr}
${data.departingPlace} → ${data.destination}
${formattedDate} — ${data.aircraftType}
Total paid: ${data.totalAmount} TND

Please present your PNR at the airport check-in counter.`;

  return { html, text };
}