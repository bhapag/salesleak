"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { QuotationWithRisk } from "@/server/data/quotations";
import { QuotationStatusBadge, QuotationRiskBadges } from "@/components/badges";
import { inputClass, selectClass, PrimaryButton } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { QUOTATION_DISPLAY_STATUSES } from "@/lib/constants";

type SortKey = "value" | "ageDays" | "followUpDate";
type SortDir = "asc" | "desc";
type DateFilter = "ALL" | "LAST_7" | "LAST_30" | "OLDER_30" | "NOT_SENT";

// A left rail, not a background wash — obvious at a glance without tinting
// the whole row. Reserved for genuine risk; a healthy/closed row stays plain.
// Rejected/Lost is deliberately never red here — closed-neutral, not a risk.
function riskRailClass(risk: QuotationWithRisk["risk"]): string {
  if (risk.isHighRiskOpportunity) return "border-l-[3px] border-l-red-500";
  if (risk.needsAttention) return "border-l-[3px] border-l-amber-400";
  return "border-l-[3px] border-l-transparent";
}

export function QuotationsTable({ quotations, users }: { quotations: QuotationWithRisk[]; users: { id: string; name: string }[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("followUpDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const result = quotations.filter((quotation) => {
      if (status !== "ALL" && quotation.risk.displayStatus !== status) return false;
      if (ownerFilter === "UNASSIGNED" && quotation.lead.ownerId) return false;
      if (ownerFilter !== "ALL" && ownerFilter !== "UNASSIGNED" && quotation.lead.ownerId !== ownerFilter) return false;
      if (overdueOnly && !quotation.risk.isOverdueFollowUp) return false;
      if (dateFilter !== "ALL") {
        if (dateFilter === "NOT_SENT") {
          if (quotation.sentAt) return false;
        } else {
          if (!quotation.sentAt) return false;
          const ageDays = Math.floor((now.getTime() - quotation.sentAt.getTime()) / (1000 * 60 * 60 * 24));
          if (dateFilter === "LAST_7" && ageDays > 7) return false;
          if (dateFilter === "LAST_30" && ageDays > 30) return false;
          if (dateFilter === "OLDER_30" && ageDays <= 30) return false;
        }
      }
      if (q) {
        const haystack = [
          quotation.quotationNumber,
          quotation.lead.customer.name,
          quotation.lead.title,
          ...quotation.items.map((i) => i.description),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "value") cmp = a.value - b.value;
      if (sortKey === "ageDays") cmp = a.risk.ageDays - b.risk.ageDays;
      if (sortKey === "followUpDate") {
        const aTime = a.followUpDate?.getTime() ?? Infinity;
        const bTime = b.followUpDate?.getTime() ?? Infinity;
        cmp = aTime - bTime;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [quotations, search, status, ownerFilter, dateFilter, overdueOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const activeFilterCount = [status !== "ALL", ownerFilter !== "ALL", dateFilter !== "ALL", overdueOnly].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setStatus("ALL");
    setOwnerFilter("ALL");
    setDateFilter("ALL");
    setOverdueOnly(false);
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
            placeholder="Search quotations, customers, products..."
            className={`${inputClass} pl-9`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label="Filter by status">
            <option value="ALL">All statuses</option>
            {QUOTATION_DISPLAY_STATUSES.map((s) => (
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

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className={selectClass}
            aria-label="Filter by date sent"
          >
            <option value="ALL">Any date sent</option>
            <option value="NOT_SENT">Not sent yet</option>
            <option value="LAST_7">Sent in last 7 days</option>
            <option value="LAST_30">Sent in last 30 days</option>
            <option value="OLDER_30">Sent over 30 days ago</option>
          </select>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-red-600"
            />
            Overdue only
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
        Showing {filtered.length} of {quotations.length} quotations
      </p>

      {filtered.length === 0 ? (
        <EmptyState hasFilters={activeFilterCount > 0 || search.length > 0} onReset={resetFilters} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card md:block">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Quotation</th>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3">Salesperson</th>
                  <SortableHeader label="Amount" align="right" active={sortKey === "value"} dir={sortDir} onClick={() => toggleSort("value")} />
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date Sent</th>
                  <SortableHeader label="Age" active={sortKey === "ageDays"} dir={sortDir} onClick={() => toggleSort("ageDays")} />
                  <th className="px-4 py-3">Next Follow-up</th>
                  <SortableHeader
                    label="Deadline"
                    active={sortKey === "followUpDate"}
                    dir={sortDir}
                    onClick={() => toggleSort("followUpDate")}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((quotation) => (
                  <QuotationRow key={quotation.id} quotation={quotation} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((quotation) => (
              <QuotationCard key={quotation.id} quotation={quotation} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QuotationRow({ quotation }: { quotation: QuotationWithRisk }) {
  const products = quotation.items.map((i) => i.description).join(", ") || "—";

  return (
    <tr className={`transition-colors duration-(--dur-micro) hover:bg-slate-50 ${riskRailClass(quotation.risk)}`}>
      <td className="max-w-[200px] px-4 py-3.5 align-top">
        <Link href={`/quotations/${quotation.id}`} className="font-medium text-slate-900 hover:underline">
          {quotation.quotationNumber}
        </Link>
        <p className="truncate text-xs text-slate-500">{quotation.lead.customer.name}</p>
        <div className="mt-1.5">
          <QuotationRiskBadges risk={quotation.risk} />
        </div>
      </td>
      <td className="max-w-[180px] px-4 py-3.5 align-top text-slate-600">
        <Link href={`/leads/${quotation.leadId}`} className="truncate hover:underline">
          {quotation.lead.title}
        </Link>
      </td>
      <td className="max-w-[200px] px-4 py-3.5 align-top text-slate-600">
        <span className="line-clamp-2">{products}</span>
      </td>
      <td className="px-4 py-3.5 align-top text-slate-600">
        {quotation.lead.owner ? quotation.lead.owner.name : <span className="font-medium text-amber-700">Unassigned</span>}
      </td>
      <td className="px-4 py-3.5 align-top text-right font-semibold tabular-nums text-slate-900">{formatCurrency(quotation.value)}</td>
      <td className="px-4 py-3.5 align-top">
        <QuotationStatusBadge status={quotation.risk.displayStatus} />
      </td>
      <td className="px-4 py-3.5 align-top tabular-nums text-slate-600">{quotation.sentAt ? formatDate(quotation.sentAt) : "Not sent"}</td>
      <td className="px-4 py-3.5 align-top tabular-nums text-slate-600">{quotation.risk.ageDays}d</td>
      <td className="max-w-[180px] px-4 py-3.5 align-top text-slate-600">
        {quotation.nextAction ?? (quotation.risk.isOpen ? <span className="font-medium text-amber-700">Not set</span> : "—")}
      </td>
      <td className={`px-4 py-3.5 align-top tabular-nums ${quotation.risk.isOverdueFollowUp ? "font-medium text-red-600" : "text-slate-600"}`}>
        {quotation.followUpDate
          ? formatDate(quotation.followUpDate)
          : quotation.risk.isOpen
            ? <span className="font-medium text-amber-700">Not set</span>
            : "—"}
      </td>
    </tr>
  );
}

function QuotationCard({ quotation }: { quotation: QuotationWithRisk }) {
  const products = quotation.items.map((i) => i.description).join(", ") || "—";
  return (
    <Link
      href={`/quotations/${quotation.id}`}
      className={`block rounded-xl border bg-white p-4 shadow-card transition-colors duration-(--dur-micro) hover:border-slate-300 ${
        quotation.risk.isHighRiskOpportunity ? "border-red-200" : quotation.risk.needsAttention ? "border-amber-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{quotation.quotationNumber}</p>
          <p className="text-xs text-slate-500">{quotation.lead.customer.name}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(quotation.value)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <QuotationStatusBadge status={quotation.risk.displayStatus} />
      </div>
      {quotation.risk.needsAttention && (
        <div className="mt-2">
          <QuotationRiskBadges risk={quotation.risk} />
        </div>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-slate-400">Next follow-up</dt>
          <dd className="text-slate-700">{quotation.nextAction ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Deadline</dt>
          <dd className={quotation.risk.isOverdueFollowUp ? "font-medium text-red-600" : "text-slate-700"}>
            {formatDate(quotation.followUpDate)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Salesperson</dt>
          <dd className="text-slate-700">{quotation.lead.owner?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Products</dt>
          <dd className="truncate text-slate-700">{products}</dd>
        </div>
      </dl>
    </Link>
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
      <p className="text-sm font-medium text-slate-900">{hasFilters ? "No quotations match your filters" : "No quotations yet"}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {hasFilters
          ? "Try adjusting or clearing your search and filters."
          : "Quotations are created from a lead once you're ready to send pricing."}
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
