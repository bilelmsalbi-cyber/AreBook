"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffMember } from "@/types/staff";

type StaffFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateBirth: string;
  salary: string;
  role: "ADMIN" | "EMPLOYEE";
  password: string;
  currentAdminPassword: string;
};

const emptyForm: StaffFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: "",
  dateBirth: "",
  salary: "",
  role: "EMPLOYEE",
  password: "",
  currentAdminPassword: "",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function creatorLabel(staff: StaffMember) {
  if (!staff.createdBy) return "System (initial account)";
  return `${staff.createdBy.firstName} ${staff.createdBy.lastName}`;
}

export default function StaffManager({
  initialStaff,
  currentAdminId,
}: {
  initialStaff: StaffMember[];
  currentAdminId: number;
}) {
  const router = useRouter();

  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Add modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState<StaffFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function updateField(field: keyof StaffFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());

    const res = await fetch(`/api/admin/staff?${params.toString()}`);
    const data = await res.json();

    setSearching(false);

    if (res.ok) {
      setStaff(data.staff);
    }
  }

  function openAddModal() {
    setForm(emptyForm);
    setError(null);
    setAddModalOpen(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/admin/staff", {
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
    setStaff((prev) => [...prev, data.staff]);
  }

  function openDeleteModal(member: StaffMember) {
    setDeleteTarget(member);
    setDeletePassword("");
    setDeleteError(null);
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteTarget) return;

    setDeleteError(null);
    setDeleting(true);

    const res = await fetch(`/api/admin/staff/${deleteTarget.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentAdminPassword: deletePassword }),
    });
    const data = await res.json();

    setDeleting(false);

    if (!res.ok) {
      setDeleteError(data.error || "Something went wrong.");
      return;
    }

    setStaff((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Staff Accounts</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Manage admin and employee accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#2563EB]"
        >
          + Add Staff
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mt-4 flex gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white disabled:opacity-60"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[#1E293B]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#111827] text-[#64748B]">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Date of Birth</th>
              <th className="px-4 py-3 font-medium">Salary</th>
              <th className="px-4 py-3 font-medium">Added By</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[#64748B]">
                  No staff accounts found.
                </td>
              </tr>
            )}
            {staff.map((member) => (
              <tr key={member.id} className="border-t border-[#1E293B] text-[#CBD5E1]">
                <td className="px-4 py-3">
                  {member.firstName} {member.lastName}
                  {member.id === currentAdminId && (
                    <span className="ml-2 text-xs text-[#64748B]">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3">{member.email}</td>
                <td className="px-4 py-3">{member.phone}</td>
                <td className="px-4 py-3">{member.role}</td>
                <td className="px-4 py-3">{formatDate(member.dateBirth)}</td>
                <td className="px-4 py-3">{member.salary}</td>
                <td className="px-4 py-3 text-xs text-[#64748B]">
                  {creatorLabel(member)}
                </td>
                <td className="px-4 py-3 text-right">
                  {/* Self-delete is blocked entirely at the UI level too —
                      not just relying on the API check. */}
                  {member.id !== currentAdminId && (
                    <button
                      type="button"
                      onClick={() => openDeleteModal(member)}
                      className="text-xs font-semibold text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Staff Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-lg font-semibold text-white">Add Staff</h2>

            <form onSubmit={handleAdd} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">First Name</label>
                  <input
                    required
                    type="text"
                    value={form.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">Last Name</label>
                  <input
                    required
                    type="text"
                    value={form.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-[#64748B]">Email</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">Phone</label>
                  <input
                    required
                    type="text"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">Gender</label>
                  <input
                    required
                    type="text"
                    value={form.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">Date of Birth</label>
                  <input
                    required
                    type="date"
                    value={form.dateBirth}
                    onChange={(e) => updateField("dateBirth", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#64748B]">Salary</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.salary}
                    onChange={(e) => updateField("salary", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-[#64748B]">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      updateField("role", e.target.value as "ADMIN" | "EMPLOYEE")
                    }
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-[#64748B]">
                    New Account Password
                  </label>
                  <input
                    required
                    type="password"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>

                <div className="col-span-2 border-t border-[#1E293B] pt-4">
                  <label className="mb-1 block text-xs text-[#64748B]">
                    Confirm Your Password
                  </label>
                  <input
                    required
                    type="password"
                    value={form.currentAdminPassword}
                    onChange={(e) =>
                      updateField("currentAdminPassword", e.target.value)
                    }
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  />
                  <p className="mt-1 text-xs text-[#64748B]">
                    Required to confirm this action is coming from you.
                  </p>
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
                  {saving ? "Saving..." : "Add Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-base font-semibold text-white">
              Delete this account?
            </h2>
            <p className="mt-2 text-sm text-[#94A3B8]">
              Are you sure you want to delete{" "}
              <span className="font-medium text-white">
                {deleteTarget.firstName} {deleteTarget.lastName}
              </span>
              ? This action cannot be undone.
            </p>

            <form onSubmit={handleDelete} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[#64748B]">
                  Confirm Your Password
                </label>
                <input
                  required
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                />
              </div>

              {deleteError && (
                <p className="text-sm text-red-400">{deleteError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}