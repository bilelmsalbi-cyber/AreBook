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
};

const emptyForm: StaffFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: "Mr",
  dateBirth: "",
  salary: "",
  role: "EMPLOYEE",
  password: "",
};

const PASSWORD_LENGTH = 10;

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function creatorLabel(staff: StaffMember) {
  if (!staff.createdBy) return "System (initial account)";
  return `${staff.createdBy.firstName} ${staff.createdBy.lastName}`;
}

// Only letters + digits allowed, capped at PASSWORD_LENGTH — used on every
// keystroke so it's physically impossible to type an 11th character or a
// symbol into the password fields.
function sanitizePasswordInput(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").slice(0, PASSWORD_LENGTH);
}

function isValidPassword(value: string) {
  return (
    value.length === PASSWORD_LENGTH &&
    /[A-Za-z]/.test(value) &&
    /[0-9]/.test(value)
  );
}

function generatePassword() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = letters + digits;

  const randomValues = new Uint32Array(PASSWORD_LENGTH);
  crypto.getRandomValues(randomValues);
  const chars = Array.from(randomValues, (n) => all[n % all.length]);

  if (!chars.some((c) => digits.includes(c))) {
    chars[0] = digits[randomValues[0] % digits.length];
  }
  if (!chars.some((c) => letters.includes(c))) {
    chars[1] = letters[randomValues[1] % letters.length];
  }

  return chars.join("");
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[#64748B]">{label}</label>
      <div className="relative">
        <input
          required
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(sanitizePasswordInput(e.target.value))}
          className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 pr-10 font-mono text-white outline-none focus:border-[#3B82F6]"
        />
        <button
          type="button"
          onClick={onToggleVisible}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </div>
  );
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

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState<StaffFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    setConfirmPassword("");
    setPasswordVisible(false);
    setConfirmPasswordVisible(false);
    setAddModalOpen(true);
  }

  function handleGeneratePassword() {
    const generated = generatePassword();
    updateField("password", generated);
    setConfirmPassword(generated);
    setPasswordVisible(true);
    setConfirmPasswordVisible(true);
  }

  function handleAddFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidPassword(form.password)) {
      setError(
        `Password must be exactly ${PASSWORD_LENGTH} characters, with at least one letter and one number.`
      );
      return;
    }

    if (form.password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setConfirmAdminPassword("");
    setConfirmError(null);
    setAddModalOpen(false);
    setConfirmOpen(true);
  }

  function handleBackToForm() {
    setConfirmOpen(false);
    setAddModalOpen(true);
  }

  async function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConfirmError(null);
    setSaving(true);

    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        currentAdminPassword: confirmAdminPassword,
      }),
    });
    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      setConfirmError(data.error || "Something went wrong.");
      return;
    }

    setConfirmOpen(false);
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

      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-lg font-semibold text-white">Add Staff</h2>

            <form onSubmit={handleAddFormSubmit} className="mt-4 space-y-4">
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
                  <select
                    required
                    value={form.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                  >
                    <option value="Mr">Mr</option>
                    <option value="Mme">Mme</option>
                  </select>
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
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-[#64748B]">
                      Password: exactly {PASSWORD_LENGTH} characters, at least
                      one letter and one number.
                    </span>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="whitespace-nowrap text-xs font-medium text-[#3B82F6] hover:text-[#60A5FA]"
                    >
                      Generate automatically
                    </button>
                  </div>
                </div>

                <PasswordField
                  label="New Account Password"
                  value={form.password}
                  onChange={(v) => updateField("password", v)}
                  visible={passwordVisible}
                  onToggleVisible={() => setPasswordVisible((v) => !v)}
                />
                <PasswordField
                  label="Re-enter Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  visible={confirmPasswordVisible}
                  onToggleVisible={() => setConfirmPasswordVisible((v) => !v)}
                />

                {form.password && (
                  <p className="col-span-2 -mt-2 text-xs text-amber-400">
                    Save this password now and give it to the employee. It
                    cannot be recovered later if forgotten.
                  </p>
                )}
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
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB]"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
            <h2 className="text-base font-semibold text-white">
              Confirm your identity
            </h2>
            <p className="mt-2 text-sm text-[#94A3B8]">
              Enter your own admin password to confirm creating this account.
            </p>

            <form onSubmit={handleConfirmSubmit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[#64748B]">
                  Your Password
                </label>
                <input
                  required
                  autoFocus
                  type="password"
                  value={confirmAdminPassword}
                  onChange={(e) => setConfirmAdminPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2 text-white outline-none focus:border-[#3B82F6]"
                />
              </div>

              {confirmError && (
                <p className="text-sm text-red-400">{confirmError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBackToForm}
                  className="rounded-lg border border-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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