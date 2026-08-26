export type BookingResult = {
  id: number;
  pnr: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  bookingDate: string;
  seatClass: "BUSINESS" | "GUEST";
  seatsHeld: number;
  tripType: "ONE_WAY" | "ROUND_TRIP";
  trip: {
    id: number;
    departingPlace: string;
    destination: string;
    departureDateTime: string;
    plane: { aircraftType: string };
  };
  // Present only when this row's round-trip return leg was found in the
  // same search results — see api/admin/bookings/route.ts grouping logic.
  returnTrip: {
    id: number;
    departingPlace: string;
    destination: string;
    departureDateTime: string;
    plane: { aircraftType: string };
  } | null;
  passengers: { person: { firstName: string; lastName: string } }[];
  // Mirrors the full PaymentStatus enum (schema.prisma) — REFUNDED is set
  // by the cancellation flow (see executeCancellation in lib/cancellation.ts).
  payment: {
    status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
    amount: number;
  } | null;
  // The customer account this booking is linked to, if any — assigned
  // at creation time (see lib/cancellation.ts), so this is always
  // present directly on the outbound row, never through linkedBooking.
  // Null means this was (or still is) a guest booking.
  customer: {
    id: number;
    person: { firstName: string; lastName: string; email: string };
  } | null;
  linkedBooking: {
    id: number;
    pnr: string | null;
    payment: { status: string; amount: number } | null;
  } | null;
};

export type TripOption = {
  id: number;
  departingPlace: string;
  destination: string;
  departureDateTime: string;
  aircraftType: string;
};

// Full passenger record shown inside the "View Passengers" modal.
export type PassengerDetail = {
  id: number;
  person: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: string;
    dateBirth: string;
  };
  document: {
    documentType: string;
    number: string;
    country: string;
    expiryDate: string;
  } | null;
  specialRequests: {
    id: number;
    requestType: string;
    price: number;
  }[];
};