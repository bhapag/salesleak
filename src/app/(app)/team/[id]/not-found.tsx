import Link from "next/link";
import { PrimaryButton } from "@/components/ui";

export default function SalespersonNotFound() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Salesperson not found</h1>
      <p className="mt-2 text-slate-600">This team member may have been removed, or the link is incorrect.</p>
      <Link href="/team">
        <PrimaryButton className="mt-4">Back to Team</PrimaryButton>
      </Link>
    </div>
  );
}
