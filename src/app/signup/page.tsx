import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/server/auth/session";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Sign Up" };

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">SalesLeak</h1>
          <p className="mt-1 text-sm text-slate-500">See which leads and quotations are at risk before revenue is lost.</p>
          <p className="mt-2 text-xs text-slate-400">
            by <span className="text-[#B08A45]">NobleArc</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Create your company workspace</h2>
          <SignupForm />
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Already have a workspace?{" "}
          <Link href="/login" className="font-medium text-slate-700 underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
