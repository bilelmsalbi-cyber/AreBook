"use client";

import { useState } from "react";
import type {
  ServicePriceItem,
  DiscountTierItem,
  CancellationTierItem,
} from "@/types/pricing";

type Tab = "services" | "discounts" | "cancellations";

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
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

  const [services, setServices] = useState(initialServices);
  const [discountTiers, setDiscountTiers] = useState(initialDiscountTiers);
  const [cancellationTiers, setCancellationTiers] = useState(initialCancellationTiers);

  const [error, setError] = useState<string | null>(null);

  // ---------- Services: edit only ----------
  // Only BAGGAGE has a max quantity — WHEELCHAIR, MEAL, and PET are each a
  // single service per passenger and have no quantity concept.
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

    setServices((prev) =>
      prev.map((s) => (s.id === editingService.id ? data.service : s))
    );
    setEditingService(null);
  }

  // ---------- Discount tiers: add + edit + delete ----------
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState<number | null>(null);
  const [discountForm, setDiscountForm] = useState({
    minTotal: "",
    maxTotal: "",
    discountPercent: "",
  });
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [deleteDiscountTarget, setDeleteDiscountTarget] = useState<DiscountTierItem | null>(null);
  const [deletingDiscount, setDeletingDiscount] = useState(false);

  function openDiscountAdd() {
    setEditingDiscountId(null);
    setDiscountForm({ minTotal: "", maxTotal: "", discountPercent: "" });
    setError(null);
    setDiscountModalOpen(true);
  }

  function openDiscountEdit(tier: DiscountTierItem) {
    setEditingDiscountId(tier.id);
    setDiscountForm({
      minTotal: String(tier.minTotal),
      maxTotal: tier.maxTotal !== null ? String(tier.maxTotal) : "",
      discountPercent: String(tier.discountPercent),
    });
    setError(null);
    setDiscountModalOpen(true);
  }

  async function handleDiscountSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingDiscount(true);
    setError(null);

    const payload = {
      minTotal: Number(discountForm.minTotal),
      maxTotal: discountForm.maxTotal === "" ? null : Number(discountForm.maxTotal),
      discountPercent: Number(discountForm.discountPercent),
    };

    const url =
      editingDiscountId === null
        ? "/api/admin/pricing/discount-tiers"
        : `/api/admin/pricing/discount-tiers/${editingDiscountId}`;
    const method = editingDiscountId === null ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSavingDiscount(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    if (editingDiscountId === null) {
      setDiscountTiers((prev) =>
        [...prev, data.tier].sort((a, b) => a.minTotal - b.minTotal)
      );
    } else {
      setDiscountTiers((prev) =>
        prev
          .map((t) => (t.id === editingDiscountId ? data.tier : t))
          .sort((a, b) => a.minTotal - b.minTotal)
      );
    }
    setDiscountModalOpen(false);
  }

  async function handleDiscountDelete() {
    if (!deleteDiscountTarget) return;
    setDeletingDiscount(true);
    setError(null);

    const res = await fetch(`/api/admin/pricing/discount-tiers/${deleteDiscountTarget.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setDeletingDiscount(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    setDiscountTiers((prev) => prev.filter((t) => t.id !== deleteDiscountTarget.id));
    setDeleteDiscountTarget(null);
  }

  // ---------- Cancellation tiers: add + edit + delete ----------
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [editingCancellationId, setEditingCancellationId] = useState<number | null>(null);
  const [cancellationForm, setCancellationForm] = useState({
    minHoursBefore: "",
    maxHoursBefore: "",
    businessDeductionPercent: "",
    guestDeductionPercent: "",
  });
  const [savingCancellation, setSavingCancellation] = useState(false);
  const [deleteCancellationTarget, setDeleteCancellationTarget] =
    useState<CancellationTierItem | null>(null);
  const [deletingCancellation, setDeletingCancellation] = useState(false);

  function openCancellationAdd() {
    setEditingCancellationId(null);
    setCancellationForm({
      minHoursBefore: "",
      maxHoursBefore: "",
      businessDeductionPercent: "",
      guestDeductionPercent: "",
    });
    setError(null);
    setCancellationModalOpen(true);
  }

  function openCancellationEdit(tier: CancellationTierItem) {
    setEditingCancellationId(tier.id);
    setCancellationForm({
      minHoursBefore: String(tier.minHoursBefore),
      maxHoursBefore: tier.maxHoursBefore !== null ? String(tier.maxHoursBefore) : "",
      businessDeductionPercent: String(tier.businessDeductionPercent),
      guestDeductionPercent: String(tier.guestDeductionPercent),
    });
    setError(null);
    setCancellationModalOpen(true);
  }

  async function handleCancellationSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingCancellation(true);
    setError(null);

    const payload = {
      minHoursBefore: Number(cancellationForm.minHoursBefore),
      maxHoursBefore:
        cancellationForm.maxHoursBefore === "" ? null : Number(cancellationForm.maxHoursBefore),
      businessDeductionPercent: Number(cancellationForm.businessDeductionPercent),
      guestDeductionPercent: Number(cancellationForm.guestDeductionPercent),
    };

    const url =
      editingCancellationId === null
        ? "/api/admin/pricing/cancellation-tiers"
        : `/api/admin/pricing/cancellation-tiers/${editingCancellationId}`;
    const method = editingCancellationId === null ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSavingCancellation(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    if (editingCancellationId === null) {
      setCancellationTiers((prev) =>
        [...prev, data.tier].sort((a, b) => a.minHoursBefore - b.minHoursBefore)
      );
    } else {
      setCancellationTiers((prev) =>
        prev
          .map((t) => (t.id === editingCancellationId ? data.tier : t))
          .sort((a, b) => a.minHoursBefore - b.minHoursBefore)
      );
    }
    setCancellationModalOpen(false);
  }

  async function handleCancellationDelete() {
    if (!deleteCancellationTarget) return;
    setDeletingCancellation(true);
    setError(null);

    const res = await fetch(
      `/api/admin/pricing/cancellation-tiers/${deleteCancellationTarget.id}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    setDeletingCancellation(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    setCancellationTiers((prev) => prev.filter((t) => t.id !== deleteCancellationTarget.id));
    setDeleteCancellationTarget(null);
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
          {isAdmin && (
            <button
              type="button"
              onClick={openDiscountAdd}
              className="rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#2563EB]"
            >
              + Add Tier
            </button>
          )}
          <div className="mt-4 overflow-hidden rounded-xl border border-[#1E293B]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#111827] text-[#64748B]">
                <tr>
                  <th className="px-4 py-3 font-medium">Min Total</th>
                  <th className="px-4 py-3 font-medium">Max Total</th>
                  <th className="px-4 py-3 font-medium">Discount</th>
                  {isAdmin && <th className="px-4 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {discountTiers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[#64748B]">
                      No discount tiers configured.
                    </td>
                  </tr>
                )}
                {discountTiers.map((tier) => (
                  <tr key={tier.id} className="border-t border-[#1E293B] text-[#CBD5E1]">
                    <td className="px-4 py-3">${tier.minTotal.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {tier.maxTotal !== null ? `$${tier.maxTotal.toFixed(2)}` : "No limit"}
                    </td>
                    <td className="px-4 py-3">{tier.discountPercent}%</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right space-x-3">
                        <button
                          type="button"
                          onClick={() => openDiscountEdit(tier)}
                          className="text-xs font-semibold text-[#3B82F6] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteDiscountTarget(tier)}
                          className="text-xs font-semibold text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Cancellation tiers tab ---------- */}
      {tab === "cancellations" && (
        <div className="mt-6">
          {isAdmin && (
            <button
              type="button"
              onClick={openCancellationAdd}
              className="rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#2563EB]"
            >
              + Add Tier
            </button>
          )}
          <div className="mt-4 overflow-hidden rounded-xl border border-[#1E293B]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#111827] text-[#64748B]">
                <tr>
                  <th className="px-4 py-3 font-medium">Min Hours Before</th>
                  <th className="px-4 py-3 font-medium">Max Hours Before</th>
                  <th className="px-4 py-3 font-medium">Business Deduction</th>
                  <th className="px-4 py-3 font-medium">Guest Deduction</th>
                  {isAdmin && <th className="px-4 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {cancellationTiers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[#64748B]">
                      No cancellation tiers configured.
                    </td>
                  </tr>
                )}
                {cancellationTiers.map((tier) => (
                  <tr key={tier.id} className="border-t border-[#1E293B] text-[#CBD5E1]">
                    <td className="px-4 py-3">{tier.minHoursBefore}h</td>
                    <td className="px-4 py-3">
                      {tier.maxHoursBefore !== null ? `${tier.maxHoursBefore}h` : "No limit"}
                    </td>
                    <td className="px-4 py-3">{tier.businessDeductionPercent}%</td>
                    <td className="px-4 py-3">{tier.guestDeductionPercent}%</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right space-x-3">
                        <button
                          type="button"
                          onClick={() => openCancellationEdit(tier)}
                          className="text-xs font-semibold text-[#3B82F6] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCancellationTarget(tier)}
                          className="text-xs font-semibold text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Service edit modal ---------- */}
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

      {/* ---------- Discount tier add/edit modal ---------- */}
      {discountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-lg font-semibold text-white">
              {editingDiscountId === null ? "Add Discount Tier" : "Edit Discount Tier"}
            </h2>
            <form onSubmit={handleDiscountSave} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs text-[#64748B]">Minimum Total ($)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountForm.minTotal}
                  onChange={(e) =>
                    setDiscountForm((f) => ({ ...f, minTotal: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#64748B]">
                  Maximum Total ($) — leave blank for no limit
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountForm.maxTotal}
                  onChange={(e) =>
                    setDiscountForm((f) => ({ ...f, maxTotal: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#64748B]">Discount Percent (0–100)</label>
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={discountForm.discountPercent}
                  onChange={(e) =>
                    setDiscountForm((f) => ({ ...f, discountPercent: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDiscountModalOpen(false)}
                  className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDiscount}
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {savingDiscount ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Discount tier delete modal ---------- */}
      {deleteDiscountTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-base font-semibold text-white">Delete this tier?</h2>
            <p className="mt-2 text-sm text-[#94A3B8]">
              This action cannot be undone. Bookings will fall back to whichever tier next
              matches their total.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteDiscountTarget(null)}
                className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDiscountDelete}
                disabled={deletingDiscount}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingDiscount ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Cancellation tier add/edit modal ---------- */}
      {cancellationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-lg font-semibold text-white">
              {editingCancellationId === null ? "Add Cancellation Tier" : "Edit Cancellation Tier"}
            </h2>
            <form onSubmit={handleCancellationSave} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs text-[#64748B]">Minimum Hours Before</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.5"
                  value={cancellationForm.minHoursBefore}
                  onChange={(e) =>
                    setCancellationForm((f) => ({ ...f, minHoursBefore: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#64748B]">
                  Maximum Hours Before — leave blank for no limit
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={cancellationForm.maxHoursBefore}
                  onChange={(e) =>
                    setCancellationForm((f) => ({ ...f, maxHoursBefore: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#64748B]">
                  Business Deduction Percent (0–100)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={cancellationForm.businessDeductionPercent}
                  onChange={(e) =>
                    setCancellationForm((f) => ({
                      ...f,
                      businessDeductionPercent: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#64748B]">
                  Guest Deduction Percent (0–100)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={cancellationForm.guestDeductionPercent}
                  onChange={(e) =>
                    setCancellationForm((f) => ({
                      ...f,
                      guestDeductionPercent: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellationModalOpen(false)}
                  className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCancellation}
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {savingCancellation ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Cancellation tier delete modal ---------- */}
      {deleteCancellationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-base font-semibold text-white">Delete this tier?</h2>
            <p className="mt-2 text-sm text-[#94A3B8]">
              This action cannot be undone. Cancellations will fall back to whichever tier next
              matches the time before departure.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteCancellationTarget(null)}
                className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCancellationDelete}
                disabled={deletingCancellation}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingCancellation ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}