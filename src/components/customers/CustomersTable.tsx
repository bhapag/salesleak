"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerSummary } from "@/server/data/customers";
import { CustomerStatusBadge, RepeatOrderBadge, CustomerSignalBadges } from "@/components/badges";
import { inputClass, selectClass, PrimaryButton } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { CUSTOMER_STATUSES } from "@/lib/constants";

type SortKey = "totalWonValue" | "lastActivityDate";
type SortDir = "asc" | "desc";

// A left rail, not a background wash — same pattern as Leads/Quotations.
// Reserved for genuine attention signals; a healthy customer stays plain.
function riskRailClass(customer: CustomerSummary): string {
  if (customer.signals.some((s) => s.severity === "critical")) return "border-l-[3px] border-l-red-500";
  if (customer.signals.length > 0) return "border-l-[3px] border-l-amber-400";
  return "border-l-[3px] border-l-transparent";
}

export function CustomersTable({ customers, users }: { customers: CustomerSummary[]; users: { id: string; name: string }[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [repeatDueOnly, setRepeatDueOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("totalWonValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = customers.filter((customer) => {
      if (status !== "ALL" && customer.customerStatus !== status) return false;
      if (ownerFilter === "UNASSIGNED" && customer.assignedSalesperson) return false;
      if (ownerFilter !== "ALL" && ownerFilter !== "UNASSIGNED" && customer.assignedSalesperson?.id !== ownerFilter) return false;
      if (repeatDueOnly && !(customer.repeatOrderSignal.status === "Repeat Order Due" || customer.repeatOrderSignal.status === "Overdue / Dormant")) {
        return false;
      }
      if (q) {
        const haystack = [customer.name, customer.companyName, customer.contactPerson, customer.phone, customer.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "totalWonValue") cmp = a.totalWonValue - b.totalWonValue;
      if (sortKey === "lastActivityDate") cmp = (a.lastActivityDate?.getTime() ?? 0) - (b.lastActivityDate?.getTime() ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [customers, search, status, ownerFilter, repeatDueOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const activeFilterCount = [status !== "ALL", ownerFilter !== "ALL", repeatDueOnly].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setStatus("ALL");
    setOwnerFilter("ALL");
    setRepeatDueOnly(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers, contacts..."
            className={`${inputClass} pl-9`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label="Filter by status">
            <option value="ALL">All statuses</option>
            {CUSTOMER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className={selectClass} aria-label="Filter by salesperson">
            <option value="ALL">All salespeople</option>
            <option value="UNASSIGNED">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={repeatDueOnly}
              onChange={(e) => setRepeatDueOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-amber-600"
            />
            Repeat order due
          </label>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-medium text-slate-500 transition-colors duration-(--dur-micro) hover:text-slate-900"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Showing {filtered.length} of {customers.length} customers
      </p>

      {filtered.length === 0 ? (
        <EmptyState hasFilters={activeFilterCount > 0 || search.length > 0} onReset={resetFilters} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card md:block">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Salesperson</th>
                  <th className="px-4 py-3 text-right">Active</th>
                  <SortableHeader
                    label="Won Value"
                    align="right"
                    active={sortKey === "totalWonValue"}
                    dir={sortDir}
                    onClick={() => toggleSort("totalWonValue")}
                  />
                  <SortableHeader
                    label="Last Activity"
                    active={sortKey === "lastActivityDate"}
                    dir={sortDir}
                    onClick={() => toggleSort("lastActivityDate")}
                  />
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Repeat Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((customer) => (
                  <CustomerRow key={customer.id} customer={customer} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomerRow({ customer }: { customer: CustomerSummary }) {
  return (
    <tr className={`transition-colors duration-(--dur-micro) hover:bg-slate-50 ${riskRailClass(customer)}`}>
      <td className="max-w-[220px] px-4 py-3.5 align-top">
        <Link href={`/customers/${customer.id}`} className="font-medium text-slate-900 hover:underline">
          {customer.name}
        </Link>
        {customer.contactPerson && <p className="truncate text-xs text-slate-500">{customer.contactPerson}</p>}
        <p className="truncate text-xs text-slate-400">
          {[customer.city, customer.state].filter(Boolean).join(", ") || "—"} · {customer.totalEnquiries} enquir
          {customer.totalEnquiries === 1 ? "y" : "ies"} · {customer.totalQuotations} quotation{customer.totalQuotations === 1 ? "" : "s"}
        </p>
        {customer.signals.length > 0 && (
          <div className="mt-1.5">
            <CustomerSignalBadges signals={customer.signals} />
          </div>
        )}
      </td>
      <td className="px-4 py-3.5 align-top text-slate-600">
        <ContactLines phone={customer.phone} email={customer.email} />
      </td>
      <td className="px-4 py-3.5 align-top text-slate-600">
        {customer.assignedSalesperson ? customer.assignedSalesperson.name : <span className="font-medium text-amber-700">Unassigned</span>}
      </td>
      <td className="px-4 py-3.5 align-top text-right tabular-nums text-slate-600">{customer.activeOpportunityCount}</td>
      <td className="px-4 py-3.5 align-top text-right font-semibold tabular-nums text-slate-900">{formatCurrency(customer.totalWonValue)}</td>
      <td className="px-4 py-3.5 align-top tabular-nums text-slate-600">{formatDate(customer.lastActivityDate)}</td>
      <td className="px-4 py-3.5 align-top">
        <CustomerStatusBadge status={customer.customerStatus} />
      </td>
      <td className="px-4 py-3.5 align-top">
        <div className="flex flex-col gap-1">
          <RepeatOrderBadge eligible={customer.repeatOrderSignal.eligible} status={customer.repeatOrderSignal.status} />
          {customer.repeatOrderSignal.lastOrderDate && (
            <span className="text-xs text-slate-400">Last order {formatDate(customer.repeatOrderSignal.lastOrderDate)}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function CustomerCard({ customer }: { customer: CustomerSummary }) {
  return (
    <Link
      href={`/customers/${customer.id}`}
      className={`block rounded-xl border bg-white p-4 shadow-card transition-colors duration-(--dur-micro) hover:border-slate-300 ${
        customer.signals.some((s) => s.severity === "critical")
          ? "border-red-200"
          : customer.signals.length > 0
            ? "border-amber-200"
            : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{customer.name}</p>
          <p className="text-xs text-slate-500">{customer.contactPerson ?? [customer.city, customer.state].filter(Boolean).join(", ")}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(customer.totalWonValue)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <RepeatOrderBadge eligible={customer.repeatOrderSignal.eligible} status={customer.repeatOrderSignal.status} />
        <CustomerStatusBadge status={customer.customerStatus} />
      </div>

      {customer.signals.length > 0 && (
        <div className="mt-2">
          <CustomerSignalBadges signals={customer.signals} />
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-slate-400">Salesperson</dt>
          <dd className="text-slate-700">{customer.assignedSalesperson?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Active opportunities</dt>
          <dd className="tabular-nums text-slate-700">{customer.activeOpportunityCount}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Last activity</dt>
          <dd className="text-slate-700">{formatDate(customer.lastActivityDate)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Contact</dt>
          <dd className="truncate text-slate-700">{customer.phone ?? customer.email ?? "—"}</dd>
        </div>
      </dl>
    </Link>
  );
}

function ContactLines({ phone, email }: { phone: string | null; email: string | null }) {
  if (!phone && !email) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={(e) => e.stopPropagation()}
          className="text-slate-700 transition-colors duration-(--dur-micro) hover:text-slate-900 hover:underline"
        >
          {phone}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          onClick={(e) => e.stopPropagation()}
          className="truncate text-xs text-slate-400 transition-colors duration-(--dur-micro) hover:text-slate-700 hover:underline"
        >
          {email}
        </a>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 transition-colors duration-(--dur-micro) ${align === "right" ? "flex-row-reverse" : ""} ${
          active ? "text-slate-900" : "text-slate-500"
        } hover:text-slate-900`}
      >
        {label}
        <span className="text-[10px]">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-slate-900">{hasFilters ? "No customers match your filters" : "No customers yet"}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {hasFilters
          ? "Try adjusting or clearing your search and filters."
          : "Customers are created automatically from leads — add or import a lead to get started."}
      </p>
      {hasFilters ? (
        <PrimaryButton className="mt-4" onClick={onReset}>
          Clear filters
        </PrimaryButton>
      ) : (
        <Link href="/leads">
          <PrimaryButton className="mt-4">Go to Leads</PrimaryButton>
        </Link>
      )}
    </div>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M17 17l-3.8-3.8" strokeLinecap="round" />
    </svg>
  );
}
