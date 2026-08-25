"use client";

import { useState } from "react";
import type {
  ServicePriceItem,
  DiscountTierItem,
  CancellationTierItem,
  DiscountTierDraft,
  CancellationTierDraft,
} from "@/types/pricing";

type Tab = "services" | "discounts" | "cancellations";

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function newKey() {
  return `new-${Math.random().toString(36).slice(2)}`;
}

export default function PricingManager({
  role,
  initialServices,
  initialDiscountTiers,
  initialCancellationTiers,
}: {
  role: string;
  initialServices: ServicePriceItem[];
  initialDiscountTiers: DiscountTierItem[];
  initialCancellationTiers: CancellationTierItem[];
}) {
  const isAdmin = role === "ADMIN";
  const [tab, setTab] = useState<Tab>("services");
  const [error, setError] = useState<string | null>(null);

  // ---------- Services: individual edit only (unaffected by the tier
  // bulk-editing change — service rows are fixed, not a gap-sensitive set) ----------
  const [services, setServices] = useState(initialServices);
  const [editingService, setEditingService] = useState<ServicePriceItem | null>(null);
  const [serviceForm, setServiceForm] = useState({ price: "", maxQuantity: "" });
  const [savingService, setSavingService] = useState(false);

  function openServiceEdit(service: ServicePriceItem) {
    setEditingService(service);
    setServiceForm({
      price: String(service.price),
      maxQuantity: service.maxQuantity !== null ? String(service.maxQuantity) : "",
    });
    setError(null);
  }

  async function handleServiceSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingService) return;
    setSavingService(true);
    setError(null);

    const isBaggage = editingService.serviceType === "BAGGAGE";

    const res = await fetch(`/api/admin/pricing/services/${editingService.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price: Number(serviceForm.price),
        maxQuantity: isBaggage
          ? serviceForm.maxQuantity === ""
            ? null
            : Number(serviceForm.maxQuantity)
          : null,
      }),
    });
    const data = await res.json();
    setSavingService(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    setServices((prev) => prev.map((s) => (s.id === editingService.id ? data.service : s)));
    setEditingService(null);
  }

  // ---------- Discount tiers: bulk edit-in-place ----------
  const [discountTiers, setDiscountTiers] = useState(initialDiscountTiers);
  const [discountEditing, setDiscountEditing] = useState(false);
  const [discountDraft, setDiscountDraft] = useState<DiscountTierDraft[]>([]);
  const [savingDiscounts, setSavingDiscounts] = useState(false);

  function startDiscountEdit() {
    setDiscountDraft(
      discountTiers.map((t) => ({
        key: String(t.id),
        minTotal: String(t.minTotal),
        maxTotal: t.maxTotal !== null ? String(t.maxTotal) : "",
        discountPercent: String(t.discountPercent),
      }))
    );
    setError(null);
    setDiscountEditing(true);
  }

  function cancelDiscountEdit() {
    setDiscountEditing(false);
    setDiscountDraft([]);
    setError(null);
  }

  function addDiscountRow() {
    setDiscountDraft((prev) => [
      ...prev,
      { key: newKey(), minTotal: "", maxTotal: "", discountPercent: "" },
    ]);
  }

  function removeDiscountRow(key: string) {
    setDiscountDraft((prev) => prev.filter((r) => r.key !== key));
  }

  function updateDiscountRow(key: string, field: keyof Omit<DiscountTierDraft, "key">, value: string) {
    setDiscountDraft((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  }

  async function saveDiscountDraft() {
    setSavingDiscounts(true);
    setError(null);

    const payload = {
      tiers: discountDraft.map((r) => ({
        minTotal: Number(r.minTotal),
        maxTotal: r.maxTotal === "" ? null : Number(r.maxTotal),
        discountPercent: Number(r.discountPercent),
      })),
    };

    const res = await fetch("/api/admin/pricing/discount-tiers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSavingDiscounts(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return; // stay in edit mode so the admin can fix it without losing work
    }

    setDiscountTiers(data.tiers);
    setDiscountEditing(false);
    setDiscountDraft([]);
  }

  // ---------- Cancellation tiers: bulk edit-in-place ----------
  const [cancellationTiers, setCancellationTiers] = useState(initialCancellationTiers);
  const [cancellationEditing, setCancellationEditing] = useState(false);
  const [cancellationDraft, setCancellationDraft] = useState<CancellationTierDraft[]>([]);
  const [savingCancellations, setSavingCancellations] = useState(false);

  function startCancellationEdit() {
    setCancellationDraft(
      cancellationTiers.map((t) => ({
        key: String(t.id),
        minHoursBefore: String(t.minHoursBefore),
        maxHoursBefore: t.maxHoursBefore !== null ? String(t.maxHoursBefore) : "",
        businessDeductionPercent: String(t.businessDeductionPercent),
        guestDeductionPercent: String(t.guestDeductionPercent),
      }))
    );
    setError(null);
    setCancellationEditing(true);
  }

  function cancelCancellationEdit() {
    setCancellationEditing(false);
    setCancellationDraft([]);
    setError(null);
  }

  function addCancellationRow() {
    setCancellationDraft((prev) => [
      ...prev,
      {
        key: newKey(),
        minHoursBefore: "",
        maxHoursBefore: "",
        businessDeductionPercent: "",
        guestDeductionPercent: "",
      },
    ]);
  }

  function removeCancellationRow(key: string) {
    setCancellationDraft((prev) => prev.filter((r) => r.key !== key));
  }

  function updateCancellationRow(
    key: string,
    field: keyof Omit<CancellationTierDraft, "key">,
    value: string
  ) {
    setCancellationDraft((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  }

  async function saveCancellationDraft() {
    setSavingCancellations(true);
    setError(null);

    const payload = {
      tiers: cancellationDraft.map((r) => ({
        minHoursBefore: Number(r.minHoursBefore),
        maxHoursBefore: r.maxHoursBefore === "" ? null : Number(r.maxHoursBefore),
        businessDeductionPercent: Number(r.businessDeductionPercent),
        guestDeductionPercent: Number(r.guestDeductionPercent),
      })),
    };

    const res = await fetch("/api/admin/pricing/cancellation-tiers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSavingCancellations(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    setCancellationTiers(data.tiers);
    setCancellationEditing(false);
    setCancellationDraft([]);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "services", label: "Service Prices" },
    { id: "discounts", label: "Round-Trip Discounts" },
    { id: "cancellations", label: "Cancellation Policy" },
  ];

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-white">Pricing & Policies</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          {isAdmin
            ? "Manage service prices, round-trip discounts, and cancellation deductions."
            : "View current service prices, round-trip discounts, and cancellation deductions."}
        </p>
      </div>

      {!isAdmin && (
        <p className="mt-3 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
          Read-only — Employee Mode
        </p>
      )}

      <div className="mt-6 flex gap-2 border-b border-[#1E293B]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
              tab === t.id
                ? "border-b-2 border-[#3B82F6] text-white"
                : "text-[#64748B] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {/* ---------- Services tab ---------- */}
      {tab === "services" && (
        <div className="mt-6 overflow-hidden rounded-xl border border-[#1E293B]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#111827] text-[#64748B]">
              <tr>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Max Quantity</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                {isAdmin && <th className="px-4 py-3 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id} className="border-t border-[#1E293B] text-[#CBD5E1]">
                  <td className="px-4 py-3 font-mono text-xs">{service.serviceType}</td>
                  <td className="px-4 py-3">{service.label}</td>
                  <td className="px-4 py-3">${service.price.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {service.serviceType === "BAGGAGE" ? service.maxQuantity ?? "—" : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">
                    {formatDate(service.updatedAt)}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openServiceEdit(service)}
                        className="text-xs font-semibold text-[#3B82F6] hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Discount tiers tab ---------- */}
      {tab === "discounts" && (
        <div className="mt-6">
          {isAdmin && !discountEditing && (
            <button
              type="button"
              onClick={startDiscountEdit}
              className="rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#2563EB]"
            >
              Edit Tiers
            </button>
          )}

          {/* ----- Read-only view ----- */}
          {!discountEditing && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#1E293B]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#111827] text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Min Total</th>
                    <th className="px-4 py-3 font-medium">Max Total</th>
                    <th className="px-4 py-3 font-medium">Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {discountTiers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-[#64748B]">
                        No discount tiers configured.
                      </td>
                    </tr>
                  )}
                  {discountTiers.map((tier) => (
                    <tr key={tier.id} className="border-t border-[#1E293B] text-[#CBD5E1]">
                      <td className="px-4 py-3">${tier.minTotal.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {tier.maxTotal !== null ? `$${tier.maxTotal.toFixed(2)}` : "No limit (∞)"}
                      </td>
                      <td className="px-4 py-3">{tier.discountPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ----- Edit mode (inline, same page) ----- */}
          {discountEditing && (
            <div className="mt-4 rounded-xl border border-[#1E293B] p-4">
              <p className="mb-3 text-xs text-[#64748B]">
                Tiers must start at 0 and end with one open-ended tier (leave &quot;Max
                Total&quot; blank for the highest tier). Adjacent tiers must connect exactly —
                no gaps, no overlap.
              </p>
              <div className="space-y-3">
                {discountDraft.map((row) => (
                  <div key={row.key} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                      <label className="mb-1 block text-xs text-[#64748B]">Min Total ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.minTotal}
                        onChange={(e) => updateDiscountRow(row.key, "minTotal", e.target.value)}
                        className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="mb-1 block text-xs text-[#64748B]">
                        Max Total ($) — blank = ∞
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.maxTotal}
                        onChange={(e) => updateDiscountRow(row.key, "maxTotal", e.target.value)}
                        className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="mb-1 block text-xs text-[#64748B]">Discount (0–100%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={row.discountPercent}
                        onChange={(e) =>
                          updateDiscountRow(row.key, "discountPercent", e.target.value)
                        }
                        className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div className="col-span-3">
                      <button
                        type="button"
                        onClick={() => removeDiscountRow(row.key)}
                        className="w-full rounded-lg border border-[#1E293B] py-2 text-xs font-semibold text-red-400 hover:border-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addDiscountRow}
                className="mt-4 rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
              >
                + Add Tier
              </button>

              <div className="mt-6 flex justify-end gap-3 border-t border-[#1E293B] pt-4">
                <button
                  type="button"
                  onClick={cancelDiscountEdit}
                  className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
                >
                  Back (discard changes)
                </button>
                <button
                  type="button"
                  onClick={saveDiscountDraft}
                  disabled={savingDiscounts}
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {savingDiscounts ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- Cancellation tiers tab ---------- */}
      {tab === "cancellations" && (
        <div className="mt-6">
          {isAdmin && !cancellationEditing && (
            <button
              type="button"
              onClick={startCancellationEdit}
              className="rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#2563EB]"
            >
              Edit Tiers
            </button>
          )}

          {/* ----- Read-only view ----- */}
          {!cancellationEditing && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#1E293B]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#111827] text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Min Hours Before</th>
                    <th className="px-4 py-3 font-medium">Max Hours Before</th>
                    <th className="px-4 py-3 font-medium">Business Deduction</th>
                    <th className="px-4 py-3 font-medium">Guest Deduction</th>
                  </tr>
                </thead>
                <tbody>
                  {cancellationTiers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-[#64748B]">
                        No cancellation tiers configured.
                      </td>
                    </tr>
                  )}
                  {cancellationTiers.map((tier) => (
                    <tr key={tier.id} className="border-t border-[#1E293B] text-[#CBD5E1]">
                      <td className="px-4 py-3">{tier.minHoursBefore}h</td>
                      <td className="px-4 py-3">
                        {tier.maxHoursBefore !== null ? `${tier.maxHoursBefore}h` : "No limit (∞)"}
                      </td>
                      <td className="px-4 py-3">{tier.businessDeductionPercent}%</td>
                      <td className="px-4 py-3">{tier.guestDeductionPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ----- Edit mode (inline, same page) ----- */}
          {cancellationEditing && (
            <div className="mt-4 rounded-xl border border-[#1E293B] p-4">
              <p className="mb-3 text-xs text-[#64748B]">
                Tiers must start at 0 hours and end with one open-ended tier (leave &quot;Max
                Hours Before&quot; blank for the highest tier). Adjacent tiers must connect
                exactly — no gaps, no overlap.
              </p>
              <div className="space-y-3">
                {cancellationDraft.map((row) => (
                  <div key={row.key} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs text-[#64748B]">Min Hours</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={row.minHoursBefore}
                        onChange={(e) =>
                          updateCancellationRow(row.key, "minHoursBefore", e.target.value)
                        }
                        className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs text-[#64748B]">
                        Max Hours — blank = ∞
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={row.maxHoursBefore}
                        onChange={(e) =>
                          updateCancellationRow(row.key, "maxHoursBefore", e.target.value)
                        }
                        className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="mb-1 block text-xs text-[#64748B]">Business Ded. (0–100%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={row.businessDeductionPercent}
                        onChange={(e) =>
                          updateCancellationRow(row.key, "businessDeductionPercent", e.target.value)
                        }
                        className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="mb-1 block text-xs text-[#64748B]">Guest Ded. (0–100%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={row.guestDeductionPercent}
                        onChange={(e) =>
                          updateCancellationRow(row.key, "guestDeductionPercent", e.target.value)
                        }
                        className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => removeCancellationRow(row.key)}
                        className="w-full rounded-lg border border-[#1E293B] py-2 text-xs font-semibold text-red-400 hover:border-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addCancellationRow}
                className="mt-4 rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
              >
                + Add Tier
              </button>

              <div className="mt-6 flex justify-end gap-3 border-t border-[#1E293B] pt-4">
                <button
                  type="button"
                  onClick={cancelCancellationEdit}
                  className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
                >
                  Back (discard changes)
                </button>
                <button
                  type="button"
                  onClick={saveCancellationDraft}
                  disabled={savingCancellations}
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {savingCancellations ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- Service edit modal (unchanged) ---------- */}
      {editingService !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-lg font-semibold text-white">Edit Service Price</h2>
            <form onSubmit={handleServiceSave} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs text-[#64748B]">Price</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                />
              </div>
              {editingService.serviceType === "BAGGAGE" && (
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Max Quantity (leave blank for none)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={serviceForm.maxQuantity}
                    onChange={(e) =>
                      setServiceForm((f) => ({ ...f, maxQuantity: e.target.value }))
                    }
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingService}
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {savingService ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}