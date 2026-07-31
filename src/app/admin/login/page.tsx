"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("admin-credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/admin/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F19] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-[#64748B]">
            ARE BOOK
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">
            Staff Console
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Restricted access — authorized personnel only
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#1E293B] bg-[#111827] p-6 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)]"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-4 py-3 text-white outline-none transition-all duration-200 focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-4 py-3 text-white outline-none transition-all duration-200 focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm font-medium text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-[#3B82F6] py-3 font-semibold text-white transition-all duration-200 hover:bg-[#2563EB] disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#475569]">
          This portal is monitored. Unauthorized access attempts are logged.
        </p>
      </div>
    </main>
  );
}
