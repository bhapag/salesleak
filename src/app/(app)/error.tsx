"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PrimaryButton, SecondaryButton } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600">
        We hit an unexpected problem loading this page. Your data is safe — try again, or head back to the dashboard.
      </p>
      {error.digest && <p className="mt-1 text-xs text-slate-400">Reference: {error.digest}</p>}
      <div className="mt-5 flex gap-2">
        <PrimaryButton type="button" onClick={reset}>
          Try again
        </PrimaryButton>
        <Link href="/">
          <SecondaryButton type="button">Back to Dashboard</SecondaryButton>
        </Link>
      </div>
    </div>
  );
}
