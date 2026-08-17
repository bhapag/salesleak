import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/server/auth/session";
import { SignupForm } from "@/components/auth/SignupForm";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Sign Up" };

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <AuthLayout
      formTitle="Create your company workspace"
      formDescription="Get started — takes less than a minute."
      footer={
        <>
          Already have a workspace?{" "}
          <Link href="/login" className="font-medium text-brand-warm-white underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthLayout>
  );
}
