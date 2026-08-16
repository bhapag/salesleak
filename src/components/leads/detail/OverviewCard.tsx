import type { LeadDetail } from "@/server/data/leads";
import { Card } from "@/components/ui";
import { SourceBadge } from "@/components/badges";
import { formatCurrency } from "@/lib/format";

export function OverviewCard({ lead }: { lead: LeadDetail }) {
  const items: { label: string; value: React.ReactNode }[] = [
    { label: "Customer", value: lead.customer.name },
    { label: "Contact phone", value: lead.customer.phone ?? "—" },
    { label: "Contact email", value: lead.customer.email ?? "—" },
    { label: "Location", value: [lead.customer.city, lead.customer.state].filter(Boolean).join(", ") || "—" },
    { label: "GST number", value: lead.customer.gstNumber ?? "—" },
    { label: "Source", value: <SourceBadge source={lead.source} /> },
    { label: "Product / requirement", value: lead.product ?? "—" },
    { label: "Quantity", value: lead.quantity ?? "—" },
    { label: "Opportunity value", value: formatCurrency(lead.estimatedValue) },
  ];

  return (
    <Card title="Overview" description={lead.title}>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-slate-400">{item.label}</dt>
            <dd className="text-sm text-slate-800">{item.value}</dd>
          </div>
        ))}
      </dl>
      {lead.description && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">Details</p>
          <p className="mt-1 text-sm text-slate-700">{lead.description}</p>
        </div>
      )}
      {lead.status === "LOST" && lead.lostReason && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2">
          <p className="text-xs font-medium text-red-700">Lost reason</p>
          <p className="text-sm text-red-800">{lead.lostReason}</p>
        </div>
      )}
    </Card>
  );
}
