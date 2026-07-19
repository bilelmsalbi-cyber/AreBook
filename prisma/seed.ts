import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ==================== planes ====================
  const plane1 = await prisma.plane.create({
    data: {
      nbrSeats: 180,
      nbrBusinessSeats: 20,
      nbrGuestSeats: 160,
      maxWeight: 45000,
      aircraftType: "Airbus A320",
      serviceStartDate: new Date("2018-05-01"),
    },
  });

  const plane2 = await prisma.plane.create({
    data: {
      nbrSeats: 250,
      nbrBusinessSeats: 30,
      nbrGuestSeats: 220,
      maxWeight: 70000,
      aircraftType: "Boeing 737",
      serviceStartDate: new Date("2020-03-15"),
    },
  });

  // ==================== trips ====================
  await prisma.trip.create({
    data: {
      departureDateTime: new Date("2026-08-01T08:00:00"),
      arrivalDateTime: new Date("2026-08-01T10:30:00"),
      planId: plane1.id,
      priceBusiness: 450,
      priceGuest: 180,
      departingPlace: "Tunis",
      destination: "Paris",
      availableSeatsBusiness: 20,
      availableSeatsGuest: 160,
    },
  });

  await prisma.trip.create({
    data: {
      departureDateTime: new Date("2026-08-02T14:00:00"),
      arrivalDateTime: new Date("2026-08-02T16:15:00"),
      planId: plane2.id,
      priceBusiness: 520,
      priceGuest: 210,
      departingPlace: "Tunis",
      destination: "Istanbul",
      availableSeatsBusiness: 30,
      availableSeatsGuest: 220,
    },
  });

  await prisma.trip.create({
    data: {
      departureDateTime: new Date("2026-08-03T06:30:00"),
      arrivalDateTime: new Date("2026-08-03T07:45:00"),
      planId: plane1.id,
      priceBusiness: 300,
      priceGuest: 120,
      departingPlace: "Sfax",
      destination: "Tunis",
      availableSeatsBusiness: 20,
      availableSeatsGuest: 160,
    },
  });

  console.log(" Seed craeted✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });