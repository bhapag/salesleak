import Link from "next/link";

export default function QuotationNotFound() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Quotation not found</h1>
      <p className="mt-2 text-slate-600">This quotation may have been removed, or the link is incorrect.</p>
      <Link href="/quotations" className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        Back to Quotations
      </Link>
    </div>
  );
}
