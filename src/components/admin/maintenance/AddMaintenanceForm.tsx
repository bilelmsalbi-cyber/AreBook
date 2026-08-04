"use client";

import { useState } from "react";
import type { Maintenance } from "@/types/maintenance";

// Add-record form only — no list rendering here.
// Reports success/cancel to the parent modal, which decides what to show next.
export default function AddMaintenanceForm({
  planeId,
  onSuccess,
  onCancel,
}: {
  planeId: number;
  onSuccess: (record: Maintenance) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch(`/api/admin/planes/${planeId}/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateMaint: date, description, notes }),
    });
    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    onSuccess(data.maintenance);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#94A3B8]">
          Add Maintenance Record
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-[#64748B] hover:text-white"
        >
          ← Back to history
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[#64748B]">Date</label>
        <input
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[#64748B]">
          Description
        </label>
        <input
          required
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[#64748B]">
          Notes (optional)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
      >
        {saving ? "Saving..." : "Add Maintenance Record"}
      </button>
    </form>
  );
}