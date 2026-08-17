import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/server/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Login" };

const DEMO_PASSWORD = "password123";

// The only companies prisma/seed.ts actually creates with the shared demo
// password. Any other company in a local database — including ones created
// by testing the real /signup flow, like "Staging Test Industries" was in
// an earlier phase — has its own real password and must never be listed
// here claiming otherwise.
const SEEDED_DEMO_COMPANY_NAMES = ["Shree Balaji Industrial Equipments Pvt. Ltd.", "Om Precision Tools & Dies Pvt. Ltd."];

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  const showDemoAccounts = process.env.NODE_ENV !== "production";
  const demoUsers = showDemoAccounts
    ? await prisma.user.findMany({
        where: { isActive: true, company: { name: { in: SEEDED_DEMO_COMPANY_NAMES } } },
        include: { company: true },
        orderBy: [{ companyId: "asc" }, { role: "asc" }],
      })
    : [];

  return (
    <AuthLayout
      formTitle="Sign in to your workspace"
      formDescription="Enter your email and password to continue."
      footer={
        <>
          New to SalesLeak?{" "}
          <Link href="/signup" className="font-medium text-brand-navy underline underline-offset-2">
            Create a company workspace
          </Link>
        </>
      }
      extra={
        showDemoAccounts &&
        demoUsers.length > 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Local demo accounts — dev only</p>
            <div className="flex flex-col gap-3">
              {Object.entries(
                demoUsers.reduce<Record<string, typeof demoUsers>>((acc, u) => {
                  (acc[u.company.name] ??= []).push(u);
                  return acc;
                }, {})
              ).map(([companyName, users]) => (
                <div key={companyName}>
                  <p className="text-xs font-medium text-slate-700">{companyName}</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {users.map((u) => (
                      <li key={u.id}>
                        {labelizeRole(u.role)}: <span className="font-mono">{u.email}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-slate-400">
                Password for every demo account: <span className="font-mono">{DEMO_PASSWORD}</span>
              </p>
            </div>
          </div>
        )
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}

function labelizeRole(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
