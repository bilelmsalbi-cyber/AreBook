"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-white via-[#FBF7EE] to-[#F3E7D0] px-6 text-center">
    <h1 className="font-display text-3xl font-semibold tracking-tight text-[#16324F]">Something went wrong</h1>
      <p className="mt-3 max-w-md text-[#5C7A96]">
        An unexpected error occurred. You can try again, or go back to the home page.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-xl bg-[#C89A5B] px-6 py-3 font-semibold text-white transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:bg-[#B8863F] hover:shadow-xl"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-[#E8DFCC] bg-white px-6 py-3 font-semibold text-[#16324F] transition-all duration-200 hover:-translate-y-1 hover:rounded-2xl hover:shadow-xl"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}