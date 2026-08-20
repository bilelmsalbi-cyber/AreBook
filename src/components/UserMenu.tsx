"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function UserMenu({ transparent = false }: { transparent?: boolean }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside of it
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return <div className="h-10 w-24" />; // placeholder, avoids layout shift
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className={
            transparent
              ? "rounded-xl border border-white/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10"
              : "rounded-xl border border-[#2563EB] px-4 py-2 text-sm font-semibold text-[#2563EB] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#EAF4FF]"
          }
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className={
            transparent
              ? "rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#1D4ED8] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              : "rounded-xl bg-linear-to-r from-[#2563EB] to-[#3B82F6] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          }
        >
          Create Account
        </Link>
      </div>
    );
  }

  const name = session.user.name ?? "";
  const initial = name.charAt(0).toUpperCase() || "?";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          transparent
            ? "flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-200 hover:bg-white/10"
            : "flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-200 hover:bg-[#EAF4FF]"
        }
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-r from-[#2563EB] to-[#3B82F6] text-sm font-semibold text-white">
          {initial}
        </span>
        <span
          className={
            transparent
              ? "hidden text-sm font-medium text-white [text-shadow:0_1px_4px_rgba(11,30,61,0.6)] md:inline"
              : "hidden text-sm font-medium text-[#16324F] md:inline"
          }
        >
          {name}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[#DCEEFF] bg-white p-2 shadow-[0_15px_35px_-15px_rgba(37,99,235,0.3)]">
          <p className="truncate px-3 py-2 text-xs text-[#5C7A96]">
            {session.user.email}
          </p>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-50"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}