import { notFound } from "next/navigation";
import { getQuotationDetail } from "@/server/data/quotations";
import { QuotationDetailView } from "@/components/quotations/QuotationDetailView";
import { requireSession } from "@/server/auth/session";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const quotation = await getQuotationDetail(id, session.companyId);
  if (!quotation) notFound();

  return <QuotationDetailView quotation={quotation} currentUserId={session.userId} />;
}
