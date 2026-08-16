import type { CustomerDetail } from "@/server/data/customers";
import { Card } from "@/components/ui";
import { CustomerSignalBadges } from "@/components/badges";

export function SignalsCard({ customer }: { customer: CustomerDetail }) {
  return (
    <Card title="Opportunity Signals">
      {customer.signals.length === 0 ? (
        <p className="text-sm text-slate-500">No active signals — this customer looks healthy right now.</p>
      ) : (
        <CustomerSignalBadges signals={customer.signals} />
      )}
    </Card>
  );
}
