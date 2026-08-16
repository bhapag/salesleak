"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerSummary } from "@/server/data/customers";
import { CustomerStatusBadge, RepeatOrderBadge, CustomerSignalBadges } from "@/components/badges";
import { formatCurrency, formatDate } from "@/lib/format";
import { CUSTOMER_STATUSES } from "@/lib/constants";

type SortKey = "totalWonValue" | "lastEnquiryDate" | "lastWonDate";
type SortDir = "asc" | "desc";

const selectClass =
  "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none";

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
      if (sortKey === "lastEnquiryDate") cmp = (a.lastEnquiryDate?.getTime() ?? 0) - (b.lastEnquiryDate?.getTime() ?? 0);
      if (sortKey === "lastWonDate") cmp = (a.lastWonDate?.getTime() ?? 0) - (b.lastWonDate?.getTime() ?? 0);
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
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers, contacts..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
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
            <button type="button" onClick={resetFilters} className="text-sm font-medium text-slate-500 hover:text-slate-900">
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
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Enquiries</th>
                  <th className="px-4 py-3 font-medium">Quotations</th>
                  <SortableHeader label="Won Value" active={sortKey === "totalWonValue"} dir={sortDir} onClick={() => toggleSort("totalWonValue")} />
                  <th className="px-4 py-3 font-medium">Salesperson</th>
                  <SortableHeader
                    label="Last Enquiry"
                    active={sortKey === "lastEnquiryDate"}
                    dir={sortDir}
                    onClick={() => toggleSort("lastEnquiryDate")}
                  />
                  <SortableHeader label="Last Order" active={sortKey === "lastWonDate"} dir={sortDir} onClick={() => toggleSort("lastWonDate")} />
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Repeat Signal</th>
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
  const needsAttention = customer.signals.some((s) => s.severity === "critical");
  const rowClass = needsAttention ? "bg-red-50/40" : customer.signals.length > 0 ? "bg-amber-50/30" : "";

  return (
    <tr className={`transition-colors hover:bg-slate-50 ${rowClass}`}>
      <td className="max-w-[200px] px-4 py-3 align-top">
        <Link href={`/customers/${customer.id}`} className="font-medium text-slate-900 hover:underline">
          {customer.name}
        </Link>
        {customer.contactPerson && <p className="truncate text-xs text-slate-500">{customer.contactPerson}</p>}
      </td>
      <td className="px-4 py-3 align-top text-slate-600">
        {customer.phone && <p>{customer.phone}</p>}
        {customer.email && <p className="text-xs text-slate-400">{customer.email}</p>}
      </td>
      <td className="px-4 py-3 align-top text-slate-600">{[customer.city, customer.state].filter(Boolean).join(", ") || "—"}</td>
      <td className="px-4 py-3 align-top text-slate-600">{customer.totalEnquiries}</td>
      <td className="px-4 py-3 align-top text-slate-600">{customer.totalQuotations}</td>
      <td className="px-4 py-3 align-top font-medium text-slate-700">{formatCurrency(customer.totalWonValue)}</td>
      <td className="px-4 py-3 align-top text-slate-600">{customer.assignedSalesperson?.name ?? "—"}</td>
      <td className="px-4 py-3 align-top text-slate-600">{formatDate(customer.lastEnquiryDate)}</td>
      <td className="px-4 py-3 align-top text-slate-600">{formatDate(customer.lastWonDate)}</td>
      <td className="px-4 py-3 align-top">
        <CustomerStatusBadge status={customer.customerStatus} />
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-1.5">
          <RepeatOrderBadge eligible={customer.repeatOrderSignal.eligible} status={customer.repeatOrderSignal.status} />
          <CustomerSignalBadges signals={customer.signals} />
        </div>
      </td>
    </tr>
  );
}

function CustomerCard({ customer }: { customer: CustomerSummary }) {
  return (
    <Link
      href={`/customers/${customer.id}`}
      className={`block rounded-xl border p-4 shadow-sm ${
        customer.signals.some((s) => s.severity === "critical")
          ? "border-red-200 bg-red-50/60"
          : customer.signals.length > 0
            ? "border-amber-200 bg-amber-50/40"
            : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{customer.name}</p>
          <p className="text-xs text-slate-500">{customer.contactPerson ?? [customer.city, customer.state].filter(Boolean).join(", ")}</p>
        </div>
        <span className="shrink-0 text-sm font-medium text-slate-700">{formatCurrency(customer.totalWonValue)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <CustomerStatusBadge status={customer.customerStatus} />
        <RepeatOrderBadge eligible={customer.repeatOrderSignal.eligible} status={customer.repeatOrderSignal.status} />
      </div>
      <div className="mt-2">
        <CustomerSignalBadges signals={customer.signals} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-slate-400">Salesperson</dt>
          <dd className="text-slate-700">{customer.assignedSalesperson?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Enquiries / Quotations</dt>
          <dd className="text-slate-700">
            {customer.totalEnquiries} / {customer.totalQuotations}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Last enquiry</dt>
          <dd className="text-slate-700">{formatDate(customer.lastEnquiryDate)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Last order</dt>
          <dd className="text-slate-700">{formatDate(customer.lastWonDate)}</dd>
        </div>
      </dl>
    </Link>
  );
}

function SortableHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-1 ${active ? "text-slate-900" : "text-slate-500"} hover:text-slate-900`}
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
        <button
          type="button"
          onClick={onReset}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Clear filters
        </button>
      ) : (
        <Link href="/leads" className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Go to Leads
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
