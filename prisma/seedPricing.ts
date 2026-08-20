// Goes in: D:\AreBook\prisma\seedPricing.ts
//
// One-time seed script — populates the three pricing tables with the
// exact values previously hardcoded in lib/pricing/*. Run once after the
// migration; safe to re-run (uses upsert, won't create duplicates).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ---- Service prices ----
  await prisma.servicePrice.upsert({
    where: { serviceType: "WHEELCHAIR" },
    update: {},
    create: {
      serviceType: "WHEELCHAIR",
      label: "Wheelchair Assistance",
      price: 0,
    },
  });

  await prisma.servicePrice.upsert({
    where: { serviceType: "MEAL" },
    update: {},
    create: {
      serviceType: "MEAL",
      label: "Special Meal (Gluten-Free)",
      price: 20,
    },
  });

  await prisma.servicePrice.upsert({
    where: { serviceType: "BAGGAGE" },
    update: {},
    create: {
      serviceType: "BAGGAGE",
      label: "Extra Baggage",
      price: 50,
      maxQuantity: 3,
    },
  });

  await prisma.servicePrice.upsert({
    where: { serviceType: "PET" },
    update: {},
    create: {
      serviceType: "PET",
      label: "Pet Travel",
      price: 21,
    },
  });

  // ---- Round-trip discount tiers ----
  const existingDiscountTiers = await prisma.roundTripDiscountTier.count();
  if (existingDiscountTiers === 0) {
    await prisma.roundTripDiscountTier.createMany({
      data: [
        { minTotal: 0, maxTotal: 500, discountPercent: 5 },
        { minTotal: 500, maxTotal: 1500, discountPercent: 10 },
        { minTotal: 1500, maxTotal: null, discountPercent: 15 },
      ],
    });
  }

  // ---- Cancellation tiers ----
  const existingCancellationTiers = await prisma.cancellationTier.count();
  if (existingCancellationTiers === 0) {
    await prisma.cancellationTier.createMany({
      data: [
        { minHoursBefore: 72, maxHoursBefore: null, businessDeductionPercent: 5, guestDeductionPercent: 10 },
        { minHoursBefore: 24, maxHoursBefore: 72, businessDeductionPercent: 25, guestDeductionPercent: 50 },
        { minHoursBefore: 2, maxHoursBefore: 24, businessDeductionPercent: 50, guestDeductionPercent: 80 },
        { minHoursBefore: 0, maxHoursBefore: 2, businessDeductionPercent: 100, guestDeductionPercent: 100 },
      ],
    });
  }

  console.log("Pricing tables seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });