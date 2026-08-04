"use client";

import { useEffect, useState } from "react";
import type { Plane } from "@/components/admin/PlanesManager";
import type { Maintenance } from "@/types/maintenance";
import MaintenanceHistoryView from "./MaintenanceHistoryView";
import AddMaintenanceForm from "./AddMaintenanceForm";

type MaintenanceView = "history" | "add";

// Rendered by PlanesManager only while a plane is selected
// (see the `{maintenancePlane && (...)}` guard there), the same
// pattern used for the Add Plane and Delete Confirmation modals.
// Because of that, this component mounts fresh every time it opens —
// no manual state reset is ever needed here.
export default function MaintenanceModal({
  plane,
  onClose,
}: {
  plane: Plane;
  onClose: () => void;
}) {
  const [view, setView] = useState<MaintenanceView>("history");
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/planes/${plane.id}/maintenance`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setFetchError(data.error || "Failed to load maintenance records.");
          return;
        }
        setMaintenances(data.maintenances);
      })
      .catch(() => {
        if (!cancelled) setFetchError("Failed to load maintenance records.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [plane.id]);

  function handleRecordAdded(newRecord: Maintenance) {
    setMaintenances((prev) => [newRecord, ...prev]);
    setView("history");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Maintenance — #{plane.id} {plane.aircraftType}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748B] hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          {view === "history" ? (
            <MaintenanceHistoryView
              maintenances={maintenances}
              loading={loading}
              error={fetchError}
              onAddClick={() => setView("add")}
            />
          ) : (
            <AddMaintenanceForm
              planeId={plane.id}
              onSuccess={handleRecordAdded}
              onCancel={() => setView("history")}
            />
          )}
        </div>
      </div>
    </div>
  );
}