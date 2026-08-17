import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
          <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl shadow-sm">
            <Image
              src="/brand/salesleak/salesleak-master-dark.png"
              alt="SalesLeak by NobleArc"
              width={1774}
              height={887}
              priority
              sizes="300px"
              className="h-auto w-full"
            />
          </div>
          <p className="mt-3 text-sm text-slate-500">See which leads and quotations are at risk before revenue is lost.</p>
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
