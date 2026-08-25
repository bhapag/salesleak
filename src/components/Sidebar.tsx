"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";

type Role = "OWNER" | "SALES_MANAGER" | "SALESPERSON";

const MANAGEMENT_ROLES: Role[] = ["OWNER", "SALES_MANAGER"];

// `group` drives the quiet section dividers below — daily work / core sales
// objects / oversight / configuration. Purely a presentation grouping over
// the existing order; it does not change destinations, order, or roles.
const navItems = [
  { href: "/", label: "Dashboard", icon: DashboardIcon, group: 1 },
  { href: "/my-day", label: "My Day", icon: MyDayIcon, group: 1 },
  { href: "/tasks", label: "Tasks", icon: TasksIcon, group: 1 },
  { href: "/leads", label: "Leads", icon: LeadsIcon, group: 2 },
  { href: "/quotations", label: "Quotations", icon: QuotationsIcon, group: 2 },
  { href: "/customers", label: "Customers", icon: CustomersIcon, group: 2 },
  { href: "/team", label: "Team", icon: TeamIcon, roles: MANAGEMENT_ROLES, group: 3 },
  { href: "/health", label: "Health", icon: HealthIcon, roles: MANAGEMENT_ROLES, group: 3 },
  { href: "/settings/integrations", label: "Integrations", icon: IntegrationsIcon, roles: MANAGEMENT_ROLES, group: 4 },
  { href: "/settings/pilot-readiness", label: "Pilot Readiness", icon: PilotReadinessIcon, roles: ["OWNER"] as Role[], group: 4 },
  { href: "/settings/billing", label: "Billing", icon: BillingIcon, roles: ["OWNER"] as Role[], group: 4 },
  { href: "/settings/company", label: "Settings", icon: SettingsIcon, roles: ["OWNER"] as Role[], group: 4 },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <Image src="/brand/salesleak/salesleak-icon-master.png" alt="SalesLeak" width={26} height={26} priority className="shrink-0 rounded-[7px]" />
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tracking-tight text-brand-navy">SalesLeak</span>
        <span className="text-[10px] text-slate-400">
          by <span className="text-[#B08A45]">NobleArc</span>
        </span>
      </div>
    </div>
  );
}

export function Sidebar({ companyName, role }: { companyName: string; role: Role }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(role));

  // Body scroll lock, Escape-to-close, and a Tab focus trap while the
  // mobile drawer is open; focus moves into the drawer on open and back
  // to the trigger button on close.
  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const trigger = triggerRef.current;
    const drawer = drawerRef.current;
    const focusable = drawer?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    focusable?.[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (e.key !== "Tab" || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [mobileOpen]);

  function renderNavLinks(onNavigate?: () => void) {
    return (
      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
        {visibleItems.map((item, i) => {
          const active = isActive(item.href);
          const showDivider = i > 0 && item.group !== visibleItems[i - 1].group;
          return (
            <Fragment key={item.href}>
              {showDivider && <div className="my-2 border-t border-slate-100" aria-hidden="true" />}
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-(--dur-micro) ${
                  active ? "bg-brand-navy text-brand-warm-white" : "text-slate-600 hover:bg-slate-100 hover:text-brand-navy"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            </Fragment>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      {/* Mobile top bar — sticky so it stays above the drawer regardless of scroll position */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Image src="/brand/salesleak/salesleak-icon-master.png" alt="SalesLeak" width={22} height={22} priority className="shrink-0 rounded-[6px]" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tracking-tight text-brand-navy">SalesLeak</span>
            <span className="text-[10px] text-slate-400">
              by <span className="text-[#B08A45]">NobleArc</span>
            </span>
          </div>
        </div>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-drawer"
          className="rounded-lg p-2 text-slate-600 transition-colors duration-(--dur-micro) hover:bg-slate-100 hover:text-slate-900"
        >
          {mobileOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden">
          <div className="drawer-backdrop-enter fixed inset-0 z-40 bg-brand-navy/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div
            id="mobile-nav-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="drawer-panel-enter fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white pt-4 shadow-modal"
          >
            <span className="truncate px-5 pb-2 text-xs text-slate-500">{companyName}</span>
            <div className="pb-4">{renderNavLinks(() => setMobileOpen(false))}</div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex flex-col gap-0.5 px-5 py-6">
          <BrandMark />
          <span className="truncate text-xs text-slate-500">{companyName}</span>
        </div>
        {renderNavLinks()}
      </aside>
    </>
  );
}

function DashboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="3" width="6" height="7" rx="1.2" />
      <rect x="11" y="3" width="6" height="4" rx="1.2" />
      <rect x="11" y="9" width="6" height="8" rx="1.2" />
      <rect x="3" y="12" width="6" height="5" rx="1.2" />
    </svg>
  );
}

function LeadsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3 5.5h14M3 10h14M3 14.5h9" strokeLinecap="round" />
    </svg>
  );
}

function QuotationsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M5 3h7l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinejoin="round" />
      <path d="M7 9h6M7 12h6M7 15h3" strokeLinecap="round" />
    </svg>
  );
}

function CustomersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M2.5 16c0-2.8 2.2-5 5-5s5 2.2 5 5" strokeLinecap="round" />
      <path d="M13 4.2c1.2.4 2 1.5 2 2.8s-.8 2.4-2 2.8M15.5 11.3c1.7.5 3 2.2 3 4.2" strokeLinecap="round" />
    </svg>
  );
}

function MyDayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5V10l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TasksIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="3.5" width="14" height="13" rx="1.5" />
      <path d="M6.5 8.5l1.5 1.5 2.5-3M6.5 13h2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TeamIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="6.5" cy="6" r="2.3" />
      <circle cx="14" cy="7" r="1.8" />
      <path d="M2.5 16c0-2.6 1.9-4.5 4-4.5s4 1.9 4 4.5M12 12.2c1.7.2 3 1.6 3 3.3" strokeLinecap="round" />
    </svg>
  );
}

function IntegrationsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.3" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.3" />
      <path d="M8.5 5.5h3a2 2 0 012 2v3M5.5 8.5v3a2 2 0 002 2h3" strokeLinecap="round" />
    </svg>
  );
}

function HealthIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M10 17s-6.2-3.8-6.2-8.4a3.6 3.6 0 016.2-2.5 3.6 3.6 0 016.2 2.5C16.2 13.2 10 17 10 17z" strokeLinejoin="round" />
      <path d="M6 9.5h2l1-2 1.5 4L11.5 9h2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PilotReadinessIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M6.5 10.2l2.2 2.2 4.8-4.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BillingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M2.5 8h15" strokeLinecap="round" />
      <path d="M5.5 12h3" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="10" cy="10" r="2.5" />
      <path
        d="M10 3v1.7M10 15.3V17M17 10h-1.7M4.7 10H3M14.9 5.1l-1.2 1.2M6.3 13.7l-1.2 1.2M14.9 14.9l-1.2-1.2M6.3 6.3L5.1 5.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}
