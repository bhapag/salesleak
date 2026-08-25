import Link from "next/link";
import { PrimaryButton } from "@/components/ui";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.</p>
        <Link href="/">
          <PrimaryButton className="mt-4">Back to SalesLeak</PrimaryButton>
        </Link>
      </div>
    </div>
  );
}
