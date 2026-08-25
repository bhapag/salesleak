"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LeadWithRisk } from "@/server/data/leads";
import { StatusBadge, PriorityBadge, RiskBadges, SourceBadge } from "@/components/badges";
import { inputClass, selectClass, PrimaryButton, SecondaryButton } from "@/components/ui";
import { formatCurrency, formatDate, formatRelativeToNow, formatSource, labelize } from "@/lib/format";
import { LEAD_STATUSES, LEAD_SOURCES } from "@/lib/constants";

type SortKey = "createdAt" | "nextActionDeadline" | "estimatedValue" | "priority";
type SortDir = "asc" | "desc";

const PRIORITY_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };

// A left rail, not a background wash — obvious at a glance without tinting
// the whole row. Reserved for genuine risk; a healthy row stays plain.
function riskRailClass(risk: LeadWithRisk["risk"]): string {
  if (risk.isHighRiskOpportunity) return "border-l-[3px] border-l-red-500";
  if (risk.needsAttention) return "border-l-[3px] border-l-amber-400";
  return "border-l-[3px] border-l-transparent";
}

export function LeadsTable({ leads, users }: { leads: LeadWithRisk[]; users: { id: string; name: string }[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [source, setSource] = useState<string>("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("nextActionDeadline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = leads.filter((lead) => {
      if (status !== "ALL" && lead.status !== status) return false;
      if (source !== "ALL" && lead.source !== source) return false;
      if (ownerFilter === "UNASSIGNED" && lead.ownerId) return false;
      if (ownerFilter !== "ALL" && ownerFilter !== "UNASSIGNED" && lead.ownerId !== ownerFilter) return false;
      if (overdueOnly && !lead.risk.isOverdue) return false;
      if (q) {
        const haystack = [lead.title, lead.customer.name, lead.product, lead.description, lead.owner?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") cmp = a.createdAt.getTime() - b.createdAt.getTime();
      if (sortKey === "estimatedValue") cmp = (a.estimatedValue ?? 0) - (b.estimatedValue ?? 0);
      if (sortKey === "priority") cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (sortKey === "nextActionDeadline") {
        const aTime = a.nextActionDeadline?.getTime() ?? Infinity;
        const bTime = b.nextActionDeadline?.getTime() ?? Infinity;
        cmp = aTime - bTime;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [leads, search, status, ownerFilter, source, overdueOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const activeFilterCount = [status !== "ALL", ownerFilter !== "ALL", source !== "ALL", overdueOnly].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setStatus("ALL");
    setOwnerFilter("ALL");
    setSource("ALL");
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
            placeholder="Search leads, customers, products..."
            className={`${inputClass} pl-9`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClass} lg:w-44`} aria-label="Filter by status">
            <option value="ALL">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>

          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className={`${selectClass} lg:w-48`} aria-label="Filter by salesperson">
            <option value="ALL">All salespeople</option>
            <option value="UNASSIGNED">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <select value={source} onChange={(e) => setSource(e.target.value)} className={`${selectClass} lg:w-44`} aria-label="Filter by source">
            <option value="ALL">All sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {formatSource(s)}
              </option>
            ))}
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
        Showing {filtered.length} of {leads.length} leads
      </p>

      {filtered.length === 0 ? (
        <EmptyState hasFilters={activeFilterCount > 0 || search.length > 0} onReset={resetFilters} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card md:block">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Product / Qty</th>
                  <SortableHeader
                    label="Value"
                    align="right"
                    active={sortKey === "estimatedValue"}
                    dir={sortDir}
                    onClick={() => toggleSort("estimatedValue")}
                  />
                  <th className="px-4 py-3">Owner</th>
                  <SortableHeader label="Priority" active={sortKey === "priority"} dir={sortDir} onClick={() => toggleSort("priority")} />
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-4 py-3">Next Action</th>
                  <SortableHeader
                    label="Deadline"
                    active={sortKey === "nextActionDeadline"}
                    dir={sortDir}
                    onClick={() => toggleSort("nextActionDeadline")}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LeadRow({ lead }: { lead: LeadWithRisk }) {
  return (
    <tr className={`transition-colors duration-(--dur-micro) hover:bg-slate-50 ${riskRailClass(lead.risk)}`}>
      <td className="max-w-[220px] px-4 py-3.5 align-top">
        <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 hover:underline">
          {lead.title}
        </Link>
        <p className="truncate text-xs text-slate-500">{lead.customer.name}</p>
        <div className="mt-1.5">
          <RiskBadges risk={lead.risk} />
        </div>
      </td>
      <td className="px-4 py-3.5 align-top">
        <SourceBadge source={lead.source} />
      </td>
      <td className="px-4 py-3.5 align-top text-slate-600">
        {lead.product ?? "—"}
        {lead.quantity && <p className="text-xs text-slate-400">{lead.quantity}</p>}
      </td>
      <td className="px-4 py-3.5 align-top text-right font-semibold tabular-nums text-slate-900">{formatCurrency(lead.estimatedValue)}</td>
      <td className="px-4 py-3.5 align-top text-slate-600">
        {lead.owner ? lead.owner.name : <span className="font-medium text-amber-700">Unassigned</span>}
      </td>
      <td className="px-4 py-3.5 align-top">
        <PriorityBadge priority={lead.priority} />
      </td>
      <td className="px-4 py-3.5 align-top">
        <StatusBadge status={lead.status} />
      </td>
      <td className="px-4 py-3.5 align-top tabular-nums text-slate-600">{formatRelativeToNow(lead.lastActivityAt)}</td>
      <td className="max-w-[200px] px-4 py-3.5 align-top text-slate-600">
        {lead.nextAction ?? (lead.risk.isActive ? <span className="font-medium text-amber-700">Not set</span> : "—")}
      </td>
      <td className={`px-4 py-3.5 align-top tabular-nums ${lead.risk.isOverdue ? "font-medium text-red-600" : "text-slate-600"}`}>
        {lead.nextActionDeadline
          ? formatDate(lead.nextActionDeadline)
          : lead.risk.isActive
            ? <span className="font-medium text-amber-700">Not set</span>
            : "—"}
      </td>
    </tr>
  );
}

function LeadCard({ lead }: { lead: LeadWithRisk }) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      className={`block rounded-xl border bg-white p-4 shadow-card transition-colors duration-(--dur-micro) hover:border-slate-300 ${
        lead.risk.isHighRiskOpportunity ? "border-red-200" : lead.risk.needsAttention ? "border-amber-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{lead.title}</p>
          <p className="text-xs text-slate-500">{lead.customer.name}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(lead.estimatedValue)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={lead.status} />
        <PriorityBadge priority={lead.priority} />
      </div>
      {lead.risk.needsAttention && (
        <div className="mt-2">
          <RiskBadges risk={lead.risk} />
        </div>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-slate-400">Next action</dt>
          <dd className="text-slate-700">{lead.nextAction ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Deadline</dt>
          <dd className={lead.risk.isOverdue ? "font-medium text-red-600" : "text-slate-700"}>{formatDate(lead.nextActionDeadline)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Owner</dt>
          <dd className="text-slate-700">{lead.owner?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Source</dt>
          <dd className="mt-0.5"><SourceBadge source={lead.source} /></dd>
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
      <p className="text-sm font-medium text-slate-900">{hasFilters ? "No leads match your filters" : "No leads yet"}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {hasFilters
          ? "Try adjusting or clearing your search and filters."
          : "Use “+ Add Lead” above to log one by hand, or bring in your existing enquiries."}
      </p>
      {hasFilters ? (
        <PrimaryButton className="mt-4" onClick={onReset}>
          Clear filters
        </PrimaryButton>
      ) : (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/leads/import">
            <SecondaryButton>Import CSV</SecondaryButton>
          </Link>
          <Link href="/settings/integrations">
            <SecondaryButton>Configure a lead source</SecondaryButton>
          </Link>
        </div>
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
