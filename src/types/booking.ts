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
    arrivalDateTime: string;
    plane: { aircraftType: string };
  };
  returnTrip: {
    id: number;
    departingPlace: string;
    destination: string;
    departureDateTime: string;
    arrivalDateTime: string;
    plane: { aircraftType: string };
  } | null;
  passengers: { person: { firstName: string; lastName: string } }[];
  payment: {
    status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
    amount: number;
  } | null;
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