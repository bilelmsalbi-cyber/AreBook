"use client";

import { usePathname } from "next/navigation";
import UserMenu from "@/components/UserMenu";

export default function SiteHeader() {
  const pathname = usePathname();

  // Don't show the customer header on any /admin/* page
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="flex items-center justify-end border-b border-[#DCEEFF] bg-white px-6 py-3 md:px-12">
      <UserMenu />
    </header>
  );
}