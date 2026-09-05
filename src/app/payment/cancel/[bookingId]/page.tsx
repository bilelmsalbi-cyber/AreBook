"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function CancelContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = params.bookingId as string;
  // Guest access token forwarded from pay/route.ts's Stripe cancel_url —
  // needed so "Back to Invoice" below still works for a guest.
  const token = searchParams.get("token") || "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-linear-to-b from-white via-[#FFF5F5] to-[#FFE5E5] px-6 text-center text-[#16324F]">
      <div className="max-w-md rounded-2xl border border-[#F3C5C5] bg-white p-8 shadow-[0_15px_35px_-15px_rgba(220,38,38,0.2)]">
        <p className="text-sm font-semibold text-[#DC2626]">
          Payment Failed
        </p>
        <h1 className="mt-2 font-display text-xl font-semibold tracking-tight text-[#16324F]">
          Payment was not completed. Please try again.
        </h1>
        <p className="mt-3 text-sm text-[#5C7A96]">
          Your booking is still reserved. No charge was made.
        </p>

        <button
          type="button"
          onClick={() => router.push(`/invoice/${bookingId}?token=${token}`)}
          className="mt-6 w-full rounded-xl bg-linear-to-r from-[#B8863F] to-[#C89A5B] py-3 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        >
          Back to Invoice
        </button>

        <Link
          href="/"
          className="mt-3 block w-full rounded-xl border border-[#EADFC7] py-3 text-sm font-medium text-[#5C7A96] transition-all duration-200 hover:border-[#B8863F] hover:text-[#16324F]"
        >
          Back to home page
        </Link>
      </div>
    </main>
  );
}

export default function CancelPage() {
  return (
    <Suspense fallback={null}>
      <CancelContent />
    </Suspense>
  );
}