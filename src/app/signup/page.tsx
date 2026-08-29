"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignupPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "Mr",
    dateBirth: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF] text-[#16324F]">
        <section className="bg-linear-to-r from-[#1D4ED8] via-[#2563EB] to-[#60A5FA] px-6 py-8 md:px-12">
          <div className="mx-auto max-w-5xl">
            <p className="font-mono text-xs tracking-[0.2em] text-[#DCEEFF]">ARE BOOK</p>
            <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">Check your email</h1>
          </div>
        </section>
        <section className="px-6 py-10 md:px-12">
          <div className="mx-auto max-w-md rounded-2xl border border-[#DCEEFF] bg-white p-6 text-center shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)]">
            <p>
              We sent a confirmation link to <strong>{form.email}</strong>. Click it to
              activate your account, then{" "}
              <Link href="/login" className="font-semibold text-[#2563EB]">
                log in
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF] text-[#16324F]">
      <section className="bg-linear-to-r from-[#1D4ED8] via-[#2563EB] to-[#60A5FA] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-xs tracking-[0.2em] text-[#DCEEFF]">ARE BOOK</p>
          <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">Create your account</h1>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)]">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#CFE3FA] bg-white py-3 font-semibold text-[#16324F] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
              </svg>
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#DCEEFF]" />
              <span className="text-xs text-[#5C7A96]">or</span>
              <div className="h-px flex-1 bg-[#DCEEFF]" />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  >
                    <option value="Mr">Mr</option>
                    <option value="Mme">Mme</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    required
                    value={form.dateBirth}
                    onChange={(e) => updateField("dateBirth", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                  />
                </div>
              </div>

              {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-xl bg-linear-to-r from-[#2563EB] to-[#3B82F6] py-3 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:rounded-2xl hover:shadow-xl disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>

              <p className="mt-4 text-center text-sm text-[#5C7A96]">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-[#2563EB]">
                  Log in
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}