"use client";

type PassengerInfo = {
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

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Same visual pattern as CustomerPassengersModal, but takes passenger
// data directly as a prop instead of fetching it — the guest lookup
// endpoint (/api/bookings/lookup) already returns full passenger details
// in its response, so there's no separate id-based call to make (and
// none to expose unauthenticated).
export default function GuestPassengersModal({
  bookingId,
  passengers,
  onClose,
}: {
  bookingId: number;
  passengers: PassengerInfo[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_20px_40px_-15px_rgba(37,99,235,0.25)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#16324F]">
            Passengers — Booking #{bookingId}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5C7A96] hover:text-[#16324F]"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 max-h-112 space-y-3 overflow-y-auto">
          {passengers.length === 0 && (
            <p className="text-sm text-[#5C7A96]">
              No passengers found for this booking.
            </p>
          )}

          {passengers.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-[#DCEEFF] bg-[#F8FBFF] p-4"
            >
              <p className="text-sm font-semibold text-[#16324F]">
                {p.person.firstName} {p.person.lastName}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#5C7A96]">
                <p>Email: {p.person.email}</p>
                <p>Phone: {p.person.phone}</p>
                <p>Gender: {p.person.gender}</p>
                <p>Date of Birth: {formatDate(p.person.dateBirth)}</p>
              </div>

              <div className="mt-3 border-t border-[#DCEEFF] pt-3">
                <p className="text-xs font-medium text-[#5C7A96]">Travel Document</p>
                {p.document ? (
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#5C7A96]">
                    <p>Type: {p.document.documentType}</p>
                    <p>Number: {p.document.number}</p>
                    <p>Country: {p.document.country}</p>
                    <p>Expires: {formatDate(p.document.expiryDate)}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-[#5C7A96]">No document on file.</p>
                )}
              </div>

              {p.specialRequests.length > 0 && (
                <div className="mt-3 border-t border-[#DCEEFF] pt-3">
                  <p className="text-xs font-medium text-[#5C7A96]">Special Requests</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-[#5C7A96]">
                    {p.specialRequests.map((r) => (
                      <li key={r.id}>
                        {r.requestType} — {r.price} TND
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}