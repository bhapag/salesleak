import Link from "next/link";
import { PrimaryButton } from "@/components/ui";

export default function LeadNotFound() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Lead not found</h1>
      <p className="mt-2 text-slate-600">This lead may have been removed, or the link is incorrect.</p>
      <Link href="/leads">
        <PrimaryButton className="mt-4">Back to Leads</PrimaryButton>
      </Link>
    </div>
  );
}
