import Link from "next/link";
import { PrimaryButton } from "@/components/ui";

export default function QuotationNotFound() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Quotation not found</h1>
      <p className="mt-2 text-slate-600">This quotation may have been removed, or the link is incorrect.</p>
      <Link href="/quotations">
        <PrimaryButton className="mt-4">Back to Quotations</PrimaryButton>
      </Link>
    </div>
  );
}
