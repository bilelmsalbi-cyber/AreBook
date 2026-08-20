// Server-only pricing engine. Reads live values from the ServicePrice,
// RoundTripDiscountTier, and CancellationTier tables — never from static
// files — so an admin can change prices without a new deploy.
//
// IMPORTANT: this file must never be imported from a "use client"
// component. It talks to the database directly (via Prisma) and has no
// meaning in the browser. Client components must go through an API route
// (see /api/pricing/preview) instead of importing this file.

import { prisma } from "@/lib/prisma";
import type { SeatClass } from "@prisma/client";

// ==================== Service prices ====================

export type RawService =
  | { type: "WHEELCHAIR" }
  | { type: "MEAL" }
  | { type: "BAGGAGE"; quantity: number }
  | { type: "PET"; petType: string; petWeight: number };

// Recomputes the correct price + label for a service, ignoring any price
// the client might have sent. Reads current prices from the database.
export async function priceService(
  service: RawService
): Promise<{ label: string; price: number }> {
  const config = await prisma.servicePrice.findUnique({
    where: { serviceType: service.type },
  });

  if (!config) {
    throw new Error(`No pricing configured for service type: ${service.type}`);
  }

  switch (service.type) {
    case "WHEELCHAIR":
      return { label: config.label, price: config.price };
    case "MEAL":
      return { label: config.label, price: config.price };
    case "BAGGAGE": {
      const maxQty = config.maxQuantity ?? Infinity;
      const qty = Math.min(maxQty, Math.max(0, service.quantity));
      return { label: `${config.label} x${qty}`, price: qty * config.price };
    }
    case "PET": {
      const weight = Math.max(0, service.petWeight);
      return {
        label: `${config.label} (${service.petType}, ${weight}kg)`,
        price: weight * config.price,
      };
    }
  }
}

// ==================== Round-trip discount ====================

export async function calculateRoundTripPrice(
  outboundPrice: number,
  returnPrice: number
): Promise<number> {
  const total = outboundPrice + returnPrice;

  const tiers = await prisma.roundTripDiscountTier.findMany({
    orderBy: { minTotal: "asc" },
  });

  const tier = tiers.find(
    (t) => total >= t.minTotal && (t.maxTotal === null || total < t.maxTotal)
  );

  if (!tier) {
    throw new Error(`No discount tier found for total: ${total}`);
  }

  return total * (1 - tier.discountPercent / 100);
}

// ==================== Cancellation refund ====================

function getHoursBefore(departureDateTime: Date, now: Date): number {
  return (departureDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
}

export async function calculateCancellationRefund(
  originalAmount: number,
  seatClass: SeatClass,
  departureDateTime: Date,
  now: Date = new Date()
): Promise<{ refundAmount: number; deductionPercent: number; deductionAmount: number }> {
  const hoursBefore = getHoursBefore(departureDateTime, now);

  if (hoursBefore < 0) {
    // Departure already passed — nothing to refund.
    return { refundAmount: 0, deductionPercent: 100, deductionAmount: originalAmount };
  }

  const tiers = await prisma.cancellationTier.findMany({
    orderBy: { minHoursBefore: "asc" },
  });

  const tier = tiers.find(
    (t) =>
      hoursBefore >= t.minHoursBefore &&
      (t.maxHoursBefore === null || hoursBefore < t.maxHoursBefore)
  );

  if (!tier) {
    throw new Error(`No cancellation tier found for hoursBefore: ${hoursBefore}`);
  }

  const deductionPercent =
    seatClass === "BUSINESS" ? tier.businessDeductionPercent : tier.guestDeductionPercent;
  const deductionAmount = originalAmount * (deductionPercent / 100);
  const refundAmount = originalAmount - deductionAmount;

  return { refundAmount, deductionPercent, deductionAmount };
}