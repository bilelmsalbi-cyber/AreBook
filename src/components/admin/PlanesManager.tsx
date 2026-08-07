"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MaintenanceModal from "@/components/admin/maintenance/MaintenanceModal";

// Exported so MaintenanceModal (and any future consumer) uses this
// as the single source of truth for the Plane shape.
export type Plane = {
  id: number;
  nbrSeats: number;
  nbrBusinessSeats: number;
  nbrGuestSeats: number;
  maxWeight: number;
  aircraftType: string;
  serviceStartDate: string;
  // null = currently in service. A date means the plane was retired on that date.
  serviceEndDate: string | null;
};

type PlaneFormState = {
  aircraftType: string;
  nbrBusinessSeats: string;
  nbrGuestSeats: string;
  maxWeight: string;
  serviceStartDate: string;
};

const emptyForm: PlaneFormState = {
  aircraftType: "",
  nbrBusinessSeats: "",
  nbrGuestSeats: "",
  maxWeight: "",
  serviceStartDate: "",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export default function PlanesManager({
  initialPlanes,
}: {
  initialPlanes: Plane[];
}) {
  const router = useRouter();
  const planes = initialPlanes;

  // Add Plane modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState<PlaneFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Retire / Return to service confirmation
  const [confirmServiceId, setConfirmServiceId] = useState<number | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceSaving, setServiceSaving] = useState(false);

  // Maintenance modal — this component only tracks WHICH plane is selected.
  // Everything else (fetching, view switching, add form) lives inside
  // MaintenanceModal and its children.
  const [maintenancePlane, setMaintenancePlane] = useState<Plane | null>(null);

  function openAddModal() {
    setForm(emptyForm);
    setError(null);
    setAddModalOpen(true);
  }

  function updateField(field: keyof PlaneFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const business = Number(form.nbrBusinessSeats);
    const guest = Number(form.nbrGuestSeats);
    const weight = Number(form.maxWeight);

    if (business < 0 || guest < 0) {
      setError("Seat counts cannot be negative.");
      return;
    }
    if (business + guest <= 0) {
      setError("Plane must have at least one seat.");
      return;
    }
    if (weight <= 0) {
      setError("Max weight must be greater than zero.");
      return;
    }

    setSaving(true);

    const res = await fetch("/api/admin/planes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    setAddModalOpen(false);
    router.refresh();
  }

  async function handleDelete(id: number) {
    setDeleteError(null);
    setDeleting(true);

    const res = await fetch(`/api/admin/planes/${id}`, { method: "DELETE" });
    const data = await res.json();

    setDeleting(false);

    if (!res.ok) {
      setDeleteError(data.error || "Something went wrong.");
      return;
    }

    setConfirmDeleteId(null);
    router.refresh();
  }

  async function handleServiceToggle(id: number, action: "retire" | "activate") {
    setServiceError(null);
    setServiceSaving(true);

    const res = await fetch(`/api/admin/planes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();

    setServiceSaving(false);

    if (!res.ok) {
      setServiceError(data.error || "Something went wrong.");
      return;
    }

    setConfirmServiceId(null);
    router.refresh();
  }

  const planePendingDelete = planes.find((p) => p.id === confirmDeleteId);
  const planePendingService = planes.find((p) => p.id === confirmServiceId);
  const serviceAction: "retire" | "activate" | null = planePendingService
    ? planePendingService.serviceEndDate === null
      ? "retire"
      : "activate"
    : null;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Fleet</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Manage all planes in the fleet.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#2563EB]"
        >
          + Add Plane
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[#1E293B]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#111827] text-[#64748B]">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Seats (B/G/Total)</th>
              <th className="px-4 py-3 font-medium">Max Weight</th>
              <th className="px-4 py-3 font-medium">In Service Since</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {planes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[#64748B]">
                  No planes yet.
                </td>
              </tr>
            )}
            {planes.map((plane) => (
              <tr key={plane.id} className="border-t border-[#1E293B] text-[#CBD5E1]">
                <td className="px-4 py-3">#{plane.id}</td>
                <td className="px-4 py-3">{plane.aircraftType}</td>
                <td className="px-4 py-3">
                  {plane.nbrBusinessSeats} / {plane.nbrGuestSeats} / {plane.nbrSeats}
                </td>
                <td className="px-4 py-3">{plane.maxWeight} kg</td>
                <td className="px-4 py-3">{formatDate(plane.serviceStartDate)}</td>
                {/* Left empty when the plane is in service (serviceEndDate is null),
                    mirroring how the value looks in the database itself. */}
                <td className="px-4 py-3">
                  {plane.serviceEndDate ? formatDate(plane.serviceEndDate) : ""}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setMaintenancePlane(plane)}
                    className="mr-3 text-xs font-semibold text-[#3B82F6] hover:underline"
                  >
                    Maintenance
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmServiceId(plane.id);
                      setServiceError(null);
                    }}
                    className="mr-3 text-xs font-semibold text-amber-400 hover:underline"
                  >
                    {plane.serviceEndDate === null ? "Retire" : "Return to Service"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteId(plane.id);
                      setDeleteError(null);
                    }}
                    className="text-xs font-semibold text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Plane Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-lg font-semibold text-white">Add Plane</h2>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Aircraft Type
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Airbus A320"
                    value={form.aircraftType}
                    onChange={(e) => updateField("aircraftType", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Business Seats
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.nbrBusinessSeats}
                    onChange={(e) => updateField("nbrBusinessSeats", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Guest Seats
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.nbrGuestSeats}
                    onChange={(e) => updateField("nbrGuestSeats", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Max Weight (kg)
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={form.maxWeight}
                    onChange={(e) => updateField("maxWeight", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Service Start Date
                  </label>
                  <input
                    required
                    type="date"
                    value={form.serviceStartDate}
                    onChange={(e) => updateField("serviceStartDate", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Add Plane"}
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
              Delete this plane?
            </h2>
            <p className="mt-2 text-sm text-[#94A3B8]">
              {planePendingDelete && (
                <>
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-white">
                    #{planePendingDelete.id} — {planePendingDelete.aircraftType}
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

      {/* Retire / Return to service confirmation dialog */}
      {confirmServiceId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-base font-semibold text-white">
              {serviceAction === "retire"
                ? "Retire this plane?"
                : "Return this plane to service?"}
            </h2>
            <p className="mt-2 text-sm text-[#94A3B8]">
              {planePendingService && (
                <>
                  Are you sure you want to{" "}
                  {serviceAction === "retire" ? "retire" : "return to service"}{" "}
                  <span className="font-medium text-white">
                    #{planePendingService.id} — {planePendingService.aircraftType}
                  </span>
                  ?
                </>
              )}
            </p>

            {serviceError && (
              <p className="mt-3 text-sm text-red-400">{serviceError}</p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmServiceId(null)}
                className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={serviceSaving}
                onClick={() =>
                  confirmServiceId &&
                  serviceAction &&
                  handleServiceToggle(confirmServiceId, serviceAction)
                }
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {serviceSaving
                  ? "Saving..."
                  : serviceAction === "retire"
                  ? "Retire"
                  : "Return to Service"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance modal — delegated entirely to its own component */}
      {maintenancePlane && (
        <MaintenanceModal
          plane={maintenancePlane}
          onClose={() => setMaintenancePlane(null)}
        />
      )}
    </div>
  );
}