/**
 * One shared header for every top-level app page — was independently
 * hand-duplicated (identical markup) across Dashboard, Leads, Quotations,
 * Customers, Team, Tasks, My Day, and Settings. A single source keeps their
 * title/subtitle hierarchy and spacing consistent, and gives every page a
 * ready slot for a trailing action without inventing a new pattern per page.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-7 sm:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
