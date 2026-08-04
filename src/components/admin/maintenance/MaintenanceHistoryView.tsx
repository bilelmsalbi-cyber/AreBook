import type { Maintenance } from "@/types/maintenance";

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Read-only view of a plane's maintenance history.
// Does not fetch data itself — receives it from the parent modal,
// which owns the fetch lifecycle (keeps this component simple/reusable).
export default function MaintenanceHistoryView({
  maintenances,
  loading,
  error,
  onAddClick,
}: {
  maintenances: Maintenance[];
  loading: boolean;
  error: string | null;
  onAddClick: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#94A3B8]">
          Maintenance History
        </h3>
        <button
          type="button"
          onClick={onAddClick}
          className="rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[#2563EB]"
        >
          + Add Record
        </button>
      </div>

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {loading && <p className="text-sm text-[#64748B]">Loading...</p>}

        {!loading && error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {!loading && !error && maintenances.length === 0 && (
          <p className="text-sm text-[#64748B]">No maintenance records yet.</p>
        )}

        {!loading &&
          !error &&
          maintenances.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F19] p-3"
            >
              <p className="text-sm font-medium text-white">
                {formatDate(m.dateMaint)} — {m.description}
              </p>
              {m.notes && (
                <p className="mt-1 text-xs text-[#64748B]">{m.notes}</p>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}