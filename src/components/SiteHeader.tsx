"use client";

import { usePathname } from "next/navigation";
import UserMenu from "@/components/UserMenu";

export default function SiteHeader() {
  const pathname = usePathname();

  // Don't show the customer header on any /admin/* page
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  // On the homepage the header floats over the hero photo, transparent,
  // instead of sitting in its own white bar.
  const isHome = pathname === "/";

  if (isHome) {
    return (
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-end bg-transparent px-6 py-4 md:px-12">
        <UserMenu transparent />
      </header>
    );
  }

  return (
    <header className="flex items-center justify-end border-b border-[#DCEEFF] bg-white px-6 py-3 md:px-12">
      <UserMenu />
    </header>
  );
}