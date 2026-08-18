"use client";

import { useState, useTransition } from "react";
import { logout } from "@/server/actions/auth";
import { labelize } from "@/lib/format";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProfileMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logout();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-(--dur-micro) hover:bg-slate-100"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-brand-warm-white">
          {initials(name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-medium text-slate-900">{name}</span>
          <span className="block text-[11px] text-slate-500">{labelize(role)}</span>
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="dropdown-enter absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-dropdown">
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-900">{name}</p>
              <p className="text-xs text-slate-500">{labelize(role)}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={pending}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {pending ? "Signing out…" : "Log out"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
