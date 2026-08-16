import Link from "next/link";

export function NotAuthorized({ message = "You don't have permission to view this page." }: { message?: string }) {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Not authorized</h1>
      <p className="mt-2 text-slate-600">{message}</p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        Back to Dashboard
      </Link>
    </div>
  );
}
