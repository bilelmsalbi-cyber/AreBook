export type SelectedService = {
  type: "WHEELCHAIR" | "MEAL" | "BAGGAGE" | "PET";
  label: string;
  price: number;
  quantity?: number;
  petType?: string;
  petWeight?: number;
};

export type PassengerForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: "Mr" | "Mme";
  dateBirth: string;
  hasDocument: boolean;
  documentType: string;
  documentNumber: string;
  documentCountry: string;
  documentExpiry: string;
  services: SelectedService[];
};

export function emptyPassenger(): PassengerForm {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "Mr",
    dateBirth: "",
    hasDocument: false,
    documentType: "Passport",
    documentNumber: "",
    documentCountry: "",
    documentExpiry: "",
    services: [],
  };
}

export function passengersStorageKey(bookingId: string) {
  return `arebook_passengers_${bookingId}`;
}