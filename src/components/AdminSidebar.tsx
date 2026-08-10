"use client";

import { useState } from "react";
import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export default function AdminSidebar({
  navItems,
  name,
  role,
  signOutAction,
}: {
  navItems: NavItem[];
  name: string;
  role: string;
  signOutAction: () => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="relative flex">
      {/* Sidebar panel — slides via width + overflow-hidden */}
      <aside
        className={`flex flex-col overflow-hidden border-r border-[#1E293B] bg-[#111827] transition-all duration-300 ease-in-out ${
          collapsed ? "w-0 border-r-0" : "w-60"
        }`}
      >
        <div className="w-60 shrink-0">
          <div className="border-b border-[#1E293B] px-5 py-5">
            <p className="font-mono text-xs tracking-[0.25em] text-[#64748B]">
              ARE BOOK
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              Staff Console
            </p>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#94A3B8] transition-colors duration-150 hover:bg-[#1E293B] hover:text-white"
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-[#1E293B] px-5 py-4">
            <p className="truncate text-sm font-medium text-white">{name}</p>
            {/* Visual indicator for read-only Employee sessions. Reuses the
                same amber accent already used for the Retire action on
                Fleet, instead of introducing a new color to the palette. */}
            {role === "EMPLOYEE" ? (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                Employee Mode
              </span>
            ) : (
              <p className="text-xs text-[#64748B]">{role}</p>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                className="mt-3 w-full rounded-lg border border-[#1E293B] py-2 text-xs font-semibold text-[#94A3B8] transition-colors duration-150 hover:border-red-500 hover:text-red-400"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Toggle button — always visible, sits at the edge of the sidebar */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex h-8 w-8 items-center justify-center self-start mt-5 -ml-4 rounded-full border border-[#1E293B] bg-[#111827] text-[#94A3B8] shadow-md transition-transform duration-300 hover:text-white"
        aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
      >
        {collapsed ? "›" : "‹"}
      </button>
    </div>
  );
}