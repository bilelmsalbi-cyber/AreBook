"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
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
            Welcome back
          </h1>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-md">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[#DCEEFF] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(37,99,235,0.2)]"
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#CFE3FA] bg-[#F8FBFF] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#2563EB] focus:bg-white focus:shadow-md"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#5C7A96]">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "Logging in..." : "Log In"}
            </button>

            <p className="mt-4 text-center text-sm text-[#5C7A96]">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold text-[#2563EB]">
                Create one
              </Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}