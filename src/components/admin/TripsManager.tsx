"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 20;

type Plane = {
  id: number;
  aircraftType: string;
  nbrSeats: number;
  // null = currently in service. A date means the plane was retired on that date.
  serviceEndDate: string | null;
};

type Trip = {
  id: number;
  departureDateTime: string;
  arrivalDateTime: string;
  planId: number;
  priceBusiness: number;
  priceGuest: number;
  departingPlace: string;
  destination: string;
  availableSeatsBusiness: number;
  availableSeatsGuest: number;
  plane: Plane;
};

type TripFormState = {
  departureDateTime: string;
  arrivalDateTime: string;
  planId: string;
  priceBusiness: string;
  priceGuest: string;
  departingPlace: string;
  destination: string;
};

type TripSearch = {
  from: string;
  to: string;
  date: string;
};

const emptyForm: TripFormState = {
  departureDateTime: "",
  arrivalDateTime: "",
  planId: "",
  priceBusiness: "",
  priceGuest: "",
  departingPlace: "",
  destination: "",
};

function toDatetimeLocal(iso: string) {
  return iso.slice(0, 16);
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
}

export default function TripsManager({
  initialTrips,
  initialHasMore,
  planes,
  role,
  initialSearch,
}: {
  initialTrips: Trip[];
  initialHasMore: boolean;
  planes: Plane[];
  role: "ADMIN" | "EMPLOYEE";
  initialSearch: TripSearch;
}) {
  const router = useRouter();
  const canManage = role === "ADMIN";

  // Local accumulator for "Load More" — starts from the server-rendered
  // first batch, grows as more batches are fetched client-side. Whenever
  // the server sends a fresh batch (new search submitted, or a mutation
  // triggers router.refresh()), this resets to match — see the effect
  // below. Note: this means any rows loaded via "Load More" are lost
  // after creating/editing/deleting a trip, since that also triggers a
  // fresh first-batch fetch. Accepted trade-off for simplicity.
  const [trips, setTrips] = useState(initialTrips);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  useEffect(() => {
    setTrips(initialTrips);
    setHasMore(initialHasMore);
  }, [initialTrips, initialHasMore]);

  // Search form inputs — initialized from the URL-driven search that
  // produced the current results, so the fields stay populated after
  // navigation/refresh.
  const [fromInput, setFromInput] = useState(initialSearch.from);
  const [toInput, setToInput] = useState(initialSearch.to);
  const [dateInput, setDateInput] = useState(initialSearch.date);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingOriginalPlaneId, setEditingOriginalPlaneId] =
    useState<number | null>(null);
  const [form, setForm] = useState<TripFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openAddModal() {
    setEditingId(null);
    setEditingOriginalPlaneId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(trip: Trip) {
    setEditingId(trip.id);
    setEditingOriginalPlaneId(trip.planId);
    setForm({
      departureDateTime: toDatetimeLocal(trip.departureDateTime),
      arrivalDateTime: toDatetimeLocal(trip.arrivalDateTime),
      planId: String(trip.planId),
      priceBusiness: String(trip.priceBusiness),
      priceGuest: String(trip.priceGuest),
      departingPlace: trip.departingPlace,
      destination: trip.destination,
    });
    setError(null);
    setModalOpen(true);
  }

  function updateField(field: keyof TripFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (new Date(form.arrivalDateTime) <= new Date(form.departureDateTime)) {
      setError("Arrival must be after departure.");
      return;
    }
    if (Number(form.priceBusiness) < 0 || Number(form.priceGuest) < 0) {
      setError("Prices cannot be negative.");
      return;
    }

    setSaving(true);

    const url = editingId
      ? `/api/admin/trips/${editingId}`
      : "/api/admin/trips";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    setModalOpen(false);
    router.refresh();
  }

  async function handleDelete(id: number) {
    setDeleteError(null);
    setDeleting(true);

    const res = await fetch(`/api/admin/trips/${id}`, { method: "DELETE" });
    const data = await res.json();

    setDeleting(false);

    if (!res.ok) {
      setDeleteError(data.error || "Something went wrong.");
      return;
    }

    setConfirmDeleteId(null);
    router.refresh();
  }

  // Route filter (from + to) requires both fields together — a single
  // filled field alone is ambiguous and blocked here before it ever
  // reaches the URL/API.
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();

    if ((fromInput && !toInput) || (!fromInput && toInput)) {
      setSearchError("Enter both From and To to search by route.");
      return;
    }

    setSearchError(null);

    const qs = new URLSearchParams();
    if (fromInput && toInput) {
      qs.set("from", fromInput);
      qs.set("to", toInput);
    }
    if (dateInput) qs.set("date", dateInput);

    router.push(`/admin/trips${qs.toString() ? `?${qs.toString()}` : ""}`);
  }

  function handleClearSearch() {
    setFromInput("");
    setToInput("");
    setDateInput("");
    setSearchError(null);
    router.push("/admin/trips");
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    setLoadMoreError(null);

    const qs = new URLSearchParams();
    if (initialSearch.from && initialSearch.to) {
      qs.set("from", initialSearch.from);
      qs.set("to", initialSearch.to);
    }
    if (initialSearch.date) qs.set("date", initialSearch.date);
    qs.set("skip", String(trips.length));
    qs.set("take", String(PAGE_SIZE));

    const res = await fetch(`/api/admin/trips?${qs.toString()}`);
    const data = await res.json();

    setLoadingMore(false);

    if (!res.ok) {
      setLoadMoreError(data.error || "Failed to load more trips.");
      return;
    }

    setTrips((prev) => [...prev, ...data.trips]);
    setHasMore(data.hasMore);
  }

  const tripPendingDelete = trips.find((t) => t.id === confirmDeleteId);
  const hasActiveSearch =
    Boolean(initialSearch.from && initialSearch.to) || Boolean(initialSearch.date);

  const dropdownPlanes = planes.filter(
    (plane) =>
      plane.serviceEndDate === null || plane.id === editingOriginalPlaneId
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Trips</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Manage all scheduled flights.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#2563EB]"
          >
            + Add Trip
          </button>
        )}
      </div>

      {/* Search bar — From/To must be filled together, Date is independent */}
      <form
        onSubmit={handleSearchSubmit}
        className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#1E293B] bg-[#111827] p-4"
      >
        <div>
          <label className="mb-1 block text-xs text-[#64748B]">From</label>
          <input
            type="text"
            placeholder="Departure city"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="w-40 rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-sm text-white outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#64748B]">To</label>
          <input
            type="text"
            placeholder="Destination city"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="w-40 rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-sm text-white outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#64748B]">Date</label>
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-sm text-white outline-none focus:border-[#3B82F6]"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB]"
        >
          Search
        </button>
        {hasActiveSearch && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="text-xs font-semibold text-[#64748B] hover:text-white"
          >
            Clear filters
          </button>
        )}
        {searchError && (
          <p className="w-full text-sm text-red-400">{searchError}</p>
        )}
      </form>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[#1E293B]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#111827] text-[#64748B]">
            <tr>
              <th className="px-4 py-3 font-medium">Route</th>
              <th className="px-4 py-3 font-medium">Departure</th>
              <th className="px-4 py-3 font-medium">Plane</th>
              <th className="px-4 py-3 font-medium">Price (B/G)</th>
              <th className="px-4 py-3 font-medium">Seats (B/G)</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[#64748B]">
                  {hasActiveSearch ? "No trips match your search." : "No trips yet."}
                </td>
              </tr>
            )}
            {trips.map((trip) => (
              <tr key={trip.id} className="border-t border-[#1E293B] text-[#CBD5E1]">
                <td className="px-4 py-3">
                  {trip.departingPlace} → {trip.destination}
                </td>
                <td className="px-4 py-3">
                  {formatDateTime(trip.departureDateTime)}
                </td>
                <td className="px-4 py-3">{trip.plane.aircraftType}</td>
                <td className="px-4 py-3">
                  {trip.priceBusiness} / {trip.priceGuest} TND
                </td>
                <td className="px-4 py-3">
                  {trip.availableSeatsBusiness} / {trip.availableSeatsGuest}
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(trip)}
                        className="mr-3 text-xs font-semibold text-[#3B82F6] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(trip.id);
                          setDeleteError(null);
                        }}
                        className="text-xs font-semibold text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-semibold text-[#94A3B8] hover:text-white disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
          {loadMoreError && (
            <p className="text-sm text-red-400">{loadMoreError}</p>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-lg font-semibold text-white">
              {editingId ? "Edit Trip" : "Add Trip"}
            </h2>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">
                    From
                  </label>
                  <input
                    required
                    type="text"
                    value={form.departingPlace}
                    onChange={(e) => updateField("departingPlace", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">
                    To
                  </label>
                  <input
                    required
                    type="text"
                    value={form.destination}
                    onChange={(e) => updateField("destination", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Departure
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={form.departureDateTime}
                    onChange={(e) => updateField("departureDateTime", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Arrival
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={form.arrivalDateTime}
                    onChange={(e) => updateField("arrivalDateTime", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Plane
                  </label>
                  <select
                    required
                    value={form.planId}
                    onChange={(e) => updateField("planId", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  >
                    <option value="">Select a plane</option>
                    {dropdownPlanes.map((plane) => (
                      <option key={plane.id} value={plane.id}>
                        #{plane.id} — {plane.aircraftType} ({plane.nbrSeats} seats)
                        {plane.serviceEndDate !== null ? " (Out of Service)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Seat capacity is taken automatically from the selected plane.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Price Business (TND)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.priceBusiness}
                    onChange={(e) => updateField("priceBusiness", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Price Guest (TND)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.priceGuest}
                    onChange={(e) => updateField("priceGuest", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Trip"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-base font-semibold text-white">
              Delete this trip?
            </h2>
            <p className="mt-2 text-sm text-[#94A3B8]">
              {tripPendingDelete && (
                <>
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-white">
                    {tripPendingDelete.departingPlace} →{" "}
                    {tripPendingDelete.destination}
                  </span>
                  ? This action cannot be undone.
                </>
              )}
            </p>

            {deleteError && (
              <p className="mt-3 text-sm text-red-400">{deleteError}</p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}