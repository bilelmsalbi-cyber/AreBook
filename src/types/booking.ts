export type BookingResult = {
  id: number;
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
  passengers: { person: { firstName: string; lastName: string } }[];
  payment: { status: "PENDING" | "PAID" | "FAILED"; amount: number } | null;
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