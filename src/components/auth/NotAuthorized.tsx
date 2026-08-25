import Link from "next/link";
import { PrimaryButton } from "@/components/ui";

export function NotAuthorized({ message = "You don't have permission to view this page." }: { message?: string }) {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Not authorized</h1>
      <p className="mt-2 text-slate-600">{message}</p>
      <Link href="/">
        <PrimaryButton className="mt-4">Back to Dashboard</PrimaryButton>
      </Link>
    </div>
  );
}
