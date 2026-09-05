"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // .eslint-disable-next-line react-hooks/set-state-in-effect -- syncing UI state from the URL query param, a valid use of effects
useEffect(() => {
    const verify = searchParams.get("verify");
    if (verify === "success") {
      setInfo("Your email has been confirmed. You can now log in.");
    } else if (verify === "expired") {
      setError("That confirmation link expired. Please request a new one below.");
      setNeedsVerification(true);
    } else if (verify === "invalid") {
      setError("That confirmation link is invalid.");
    }

    const match = document.cookie.match(/(?:^|; )oauth_error=([^;]*)/);
    const oauthError = match ? decodeURIComponent(match[1]) : null;
    if (oauthError === "no_account") {
      setError("No account is linked to this Google email yet. Please create an account first.");
      document.cookie = "oauth_error=; path=/; max-age=0";
    } else if (oauthError === "account_exists") {
      setError("This email is already linked to an existing account. Please log in below.");
      document.cookie = "oauth_error=; path=/; max-age=0";
    }
  }, [searchParams]);

  function handleGoogleSignIn() {
    document.cookie = "oauth_intent=login; path=/; max-age=120";
    signIn("google", { callbackUrl: "/" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setResendMessage(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === "email_not_verified") {
        setError("Please confirm your email address before logging in.");
        setNeedsVerification(true);
      } else {
        setError("Invalid email or password.");
      }
      return;
    }

    router.push("/");
  }

  async function handleResend() {
    setResendLoading(true);
    setResendMessage(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setResendMessage(data.message || "If eligible, a new link was sent.");
    } catch {
      setResendMessage("Something went wrong. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-white via-[#FBF7EE] to-[#F3E7D0] text-[#16324F]">
      <section className="bg-linear-to-r from-[#0B1E3D] via-[#16324F] to-[#2C4A6E] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-xs tracking-[0.2em] text-[#EADFC7]">ARE BOOK</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">Welcome back</h1>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-[#EADFC7] bg-white p-6 shadow-[0_15px_35px_-15px_rgba(11,30,61,0.2)]">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#E8DFCC] bg-white py-3 font-semibold text-[#16324F] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
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
              <div className="h-px flex-1 bg-[#EADFC7]" />
              <span className="text-xs text-[#5C7A96]">or</span>
              <div className="h-px flex-1 bg-[#EADFC7]" />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#5C7A96]">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-[#E8DFCC] bg-[#FAF6EC] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#B8863F] focus:bg-white focus:shadow-md"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#5C7A96]">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#E8DFCC] bg-[#FAF6EC] px-4 py-3 text-[#16324F] outline-none transition-all duration-200 focus:-translate-y-0.5 focus:rounded-xl focus:border-[#B8863F] focus:bg-white focus:shadow-md"
                  />
                </div>
              </div>

              {info && <p className="mt-4 text-sm font-medium text-green-600">{info}</p>}
              {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

              {needsVerification && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendLoading || !email}
                    className="text-sm font-semibold text-[#B8863F] disabled:opacity-60"
                  >
                    {resendLoading ? "Sending..." : "Resend confirmation email"}
                  </button>
                  {resendMessage && (
                    <p className="mt-1 text-xs text-[#5C7A96]">{resendMessage}</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-xl bg-linear-to-r from-[#B8863F] to-[#C89A5B] py-3 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:rounded-2xl hover:shadow-xl disabled:opacity-60"
              >
                {loading ? "Logging in..." : "Log In"}
              </button>

              <p className="mt-4 text-center text-sm text-[#5C7A96]">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-semibold text-[#B8863F]">
                  Create one
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}