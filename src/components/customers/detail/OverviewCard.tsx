import type { CustomerDetail } from "@/server/data/customers";
import { Card } from "@/components/ui";

export function OverviewCard({ customer }: { customer: CustomerDetail }) {
  const items: { label: string; value: React.ReactNode }[] = [
    { label: "Company", value: customer.companyName ?? customer.name },
    { label: "Contact person", value: customer.contactPerson ?? "—" },
    { label: "Phone", value: customer.phone ?? "—" },
    { label: "Email", value: customer.email ?? "—" },
    { label: "Location", value: [customer.city, customer.state].filter(Boolean).join(", ") || "—" },
    { label: "GST number", value: customer.gstNumber ?? "—" },
  ];

  return (
    <Card title="Customer Information">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-slate-400">{item.label}</dt>
            <dd className="text-sm text-slate-800">{item.value}</dd>
          </div>
        ))}
      </dl>

      {customer.productsRequested.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs text-slate-400">Products previously requested</p>
          <div className="flex flex-wrap gap-1.5">
            {customer.productsRequested.map((p) => (
              <span key={p} className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
