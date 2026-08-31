"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [lockedSeconds, setLockedSeconds] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function checkLockStatus() {
    try {
      const res = await fetch("/api/auth/admin/login-status", { method: "POST" });
      const data = await res.json();
      setLockedSeconds(data.locked ? data.retryAfterSeconds : 0);
    } catch {
    }
  }

  useEffect(() => {
    if (lockedSeconds <= 0) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    countdownRef.current = setInterval(() => {
      setLockedSeconds((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          checkLockStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedSeconds > 0]);

  const isLocked = lockedSeconds > 0;

  async function getCsrfToken() {
    const csrfRes = await fetch("/api/auth/admin/csrf");
    const { csrfToken } = await csrfRes.json();
    return csrfToken as string;
  }

  async function checkIfNowAuthenticated(): Promise<boolean> {
    const sessionRes = await fetch("/api/auth/admin/session");
    const session = await sessionRes.json();
    return Boolean(session?.user?.adminId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) return;
    setError(null);
    setLoading(true);

    try {
      const optionsRes = await fetch("/api/auth/admin/passkey/authenticate/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!optionsRes.ok) {
        setLoading(false);
        await checkLockStatus();
        setError("Too many attempts. Please wait.");
        return;
      }
      const options = await optionsRes.json();
      const hasPasskey =
        Array.isArray(options.allowCredentials) && options.allowCredentials.length > 0;

      const csrfToken = await getCsrfToken();

      if (!hasPasskey) {
        await fetch("/api/auth/admin/callback/admin-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ email, password, csrfToken }),
          redirect: "manual",
        });
      } else {
        let assertion;
        try {
          assertion = await startAuthentication(options);
        } catch {
          setLoading(false);
          setError("Passkey step was cancelled or failed.");
          return;
        }

        await fetch("/api/auth/admin/callback/admin-2fa", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            email,
            password,
            assertion: JSON.stringify(assertion),
            csrfToken,
          }),
          redirect: "manual",
        });
      }

      const authenticated = await checkIfNowAuthenticated();
      setLoading(false);

      if (authenticated) {
        router.push("/admin/dashboard");
        router.refresh();
        return;
      }

      setError("Invalid Login credentials.");
      await checkLockStatus();
    } catch (err) {
      console.error(err);
      setLoading(false);
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F19] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-[#64748B]">ARE BOOK</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Staff Console</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Restricted access — authorized personnel only
          </p>
        </div>

        <div className="relative">
          <form
            onSubmit={handleSubmit}
            className={`rounded-2xl border border-[#1E293B] bg-[#111827] p-6 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] transition-all duration-300 ${
              isLocked ? "pointer-events-none blur-sm select-none" : ""
            }`}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
                  Email
                </label>
                <input
                  type="email"
                  required
                  disabled={isLocked}
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
                  disabled={isLocked}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F19] px-4 py-3 text-white outline-none transition-all duration-200 focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
                />
              </div>
            </div>

            {error && !isLocked && (
              <p className="mt-4 text-sm font-medium text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || isLocked}
              className="mt-6 w-full rounded-lg bg-[#3B82F6] py-3 font-semibold text-white transition-all duration-200 hover:bg-[#2563EB] disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/40">
              <p className="text-3xl font-bold text-white tabular-nums">
                {Math.floor(lockedSeconds / 60)}:{String(lockedSeconds % 60).padStart(2, "0")}
              </p>
              <p className="mt-2 max-w-50 text-center text-sm text-[#94A3B8]">
                Too many failed attempts. Try again shortly.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#475569]">
          This portal is monitored. Unauthorized access attempts are logged.
        </p>
      </div>
    </main>
  );
}