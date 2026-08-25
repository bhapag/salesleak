"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PrimaryButton, SecondaryButton } from "@/components/ui";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">We hit an unexpected problem. Try again, or head back to sign in.</p>
        {error.digest && <p className="mt-1 text-xs text-slate-400">Reference: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <PrimaryButton type="button" onClick={reset}>
            Try again
          </PrimaryButton>
          <Link href="/login">
            <SecondaryButton type="button">Back to sign in</SecondaryButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
