"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "OWNER" | "SALES_MANAGER" | "SALESPERSON";

const MANAGEMENT_ROLES: Role[] = ["OWNER", "SALES_MANAGER"];

/**
 * Settings previously read as four disconnected pages, each reachable only
 * from its own separate main-sidebar entry — nothing tied them together as
 * one place. This tab strip turns them into a single coherent settings
 * experience without changing any of the underlying routes (so existing
 * links, the main sidebar, and role gates on each page are untouched).
 */
const TABS = [
  { href: "/settings/company", label: "Workspace" },
  { href: "/settings/integrations", label: "Integrations", roles: MANAGEMENT_ROLES },
  { href: "/settings/billing", label: "Billing", roles: ["OWNER"] as Role[] },
  { href: "/settings/pilot-readiness", label: "Readiness", roles: ["OWNER"] as Role[] },
  { href: "/settings/account", label: "Account" },
];

export function SettingsNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const visible = TABS.filter((t) => !t.roles || t.roles.includes(role));

  return (
    <div className="border-b border-slate-200 bg-white px-4 sm:px-8">
      {/* Scrollable rather than wrapping so the strip stays one line at every
          width, with the scrollbar itself hidden — a visible grey track under
          the tabs read as a rendering artifact on tablet widths. */}
      <nav
        className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Settings"
      >
        {visible.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors duration-(--dur-micro) ${
                active ? "border-brand-navy text-slate-900" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        <a
          href="mailto:salesleak.support@gmail.com"
          className="ml-auto shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium text-slate-500 transition-colors duration-(--dur-micro) hover:border-slate-300 hover:text-slate-800"
        >
          Support
        </a>
      </nav>
    </div>
  );
}
