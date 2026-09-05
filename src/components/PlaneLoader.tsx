"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function PlaneLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4">
      <div className="h-96 w-60">
        <DotLottieReact
          src="/PlaneLoader.lottie"
          loop
          autoplay
        />
      </div>
      <p className="text-sm font-medium text-[#16324F]">{label}</p>
    </div>
  );
}