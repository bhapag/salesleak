import Link from "next/link";
import { PrimaryButton } from "@/components/ui";

export default function CustomerNotFound() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Customer not found</h1>
      <p className="mt-2 text-slate-600">This customer may have been removed, or the link is incorrect.</p>
      <Link href="/customers">
        <PrimaryButton className="mt-4">Back to Customers</PrimaryButton>
      </Link>
    </div>
  );
}
