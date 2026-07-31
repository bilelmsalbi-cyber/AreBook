"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
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

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Step 1: create the account
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    // Step 2: auto sign-in with the same credentials
    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      // Account was created but auto-login failed — send them to login manually
      router.push("/login");
      return;
    }

    router.push("/");
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF] text-[#16324F]">
      <section className="bg-linear-to-r from-[#1D4ED8] via-[#2563EB] to-[#60A5FA] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-xs tracking-[0.2em] text-[#DCEEFF]">
            ARE BOOK
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            Create your account
          </h1>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)]"
          >
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

            {error && (
              <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
            )}

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
      </section>
    </main>
  );
}