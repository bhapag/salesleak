"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type GlobalSearchResult, type SearchResultItem } from "@/server/actions/search";

const EMPTY: GlobalSearchResult = { customers: [], leads: [], quotations: [] };

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult>(EMPTY);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pending, startTransition] = useTransition();

  const effectiveResults = query.trim().length < 2 ? EMPTY : results;
  const flatResults: (SearchResultItem & { group: string })[] = [
    ...effectiveResults.customers.map((r) => ({ ...r, group: "Customers" })),
    ...effectiveResults.leads.map((r) => ({ ...r, group: "Leads" })),
    ...effectiveResults.quotations.map((r) => ({ ...r, group: "Quotations" })),
  ];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearch(query);
        setResults(r);
        setActiveIndex(0);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function go(item: SearchResultItem) {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    router.push(item.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatResults[activeIndex];
      if (item) go(item);
    }
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Search customers, leads, quotations…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-14 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-(--dur-micro) focus:border-brand-navy focus:bg-white focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          Ctrl K
        </kbd>
      </div>

      {showDropdown && (
        <div className="dropdown-enter absolute left-0 right-0 top-full z-20 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-dropdown">
          {pending && flatResults.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">Searching…</p>
          ) : flatResults.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">No matches for &ldquo;{query}&rdquo;.</p>
          ) : (
            (["Customers", "Leads", "Quotations"] as const).map((group) => {
              const items = flatResults.filter((r) => r.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="border-b border-slate-100 py-1 last:border-b-0">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                  {items.map((item) => {
                    const flatIdx = flatResults.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(item)}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                        className={`flex w-full flex-col px-3 py-1.5 text-left ${flatIdx === activeIndex ? "bg-slate-100" : ""}`}
                      >
                        <span className="truncate text-sm text-slate-900">{item.title}</span>
                        <span className="truncate text-xs text-slate-500">{item.subtitle}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M16.5 16.5l-3.8-3.8" strokeLinecap="round" />
    </svg>
  );
}
