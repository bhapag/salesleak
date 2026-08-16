import { requireSession } from "@/server/auth/session";
import { canManageTeam } from "@/server/auth/permissions";
import { NotAuthorized } from "@/components/auth/NotAuthorized";
import { getIntegrationsForCompany, getIngestionHistory, getFailedIngestions } from "@/server/data/ingestion";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { FailedIngestionQueue } from "@/components/integrations/FailedIngestionQueue";
import { formatSource, formatDateTime } from "@/lib/format";

export default async function IntegrationsPage() {
  const session = await requireSession();
  if (!canManageTeam(session.role)) {
    return <NotAuthorized message="Integrations are visible to the Owner and Sales Managers." />;
  }

  const [connectors, history, failedIngestions] = await Promise.all([
    getIntegrationsForCompany(session.companyId),
    getIngestionHistory(session.companyId),
    getFailedIngestions(session.companyId),
  ]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <h1 className="text-xl font-semibold text-slate-900">Integrations</h1>
        <p className="text-sm text-slate-500">
          Where enquiries can come from. Every source normalizes into the same lead — CSV import, manual entry, IndiaMART (test mode), and website
          forms work today; the rest are on the way.
        </p>
      </header>

      <main className="flex flex-col gap-6 px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {connectors.map((c) => (
            <IntegrationCard key={c.type} connector={c} />
          ))}
        </div>

        <FailedIngestionQueue entries={failedIngestions} />

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Import History</h2>
            <p className="text-xs text-slate-500">Every CSV import, manual add, and webhook delivery, most recent first.</p>
          </div>

          {history.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No imports yet. CSV uploads, manually added leads, and webhook deliveries will show up here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-5 py-3 font-medium">File</th>
                    <th className="px-5 py-3 font-medium">By</th>
                    <th className="px-5 py-3 font-medium">Received</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 font-medium">Duplicates</th>
                    <th className="px-5 py-3 font-medium">Invalid</th>
                    <th className="px-5 py-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-700">{formatSource(h.source)}</td>
                      <td className="px-5 py-3 text-slate-500">{h.fileName ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-500">{h.triggeredBy?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{h.recordsReceived}</td>
                      <td className="px-5 py-3 font-medium text-emerald-600">{h.recordsCreated}</td>
                      <td className="px-5 py-3 text-amber-700">{h.duplicatesSkipped}</td>
                      <td className="px-5 py-3 text-red-600">{h.invalidRows}</td>
                      <td className="px-5 py-3 text-slate-400">{formatDateTime(h.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
