import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/server/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";
import { prisma } from "@/lib/prisma";

const DEMO_PASSWORD = "password123";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  const showDemoAccounts = process.env.NODE_ENV !== "production";
  const demoUsers = showDemoAccounts
    ? await prisma.user.findMany({
        where: { isActive: true },
        include: { company: true },
        orderBy: [{ companyId: "asc" }, { role: "asc" }],
      })
    : [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">SalesLeak</h1>
          <p className="mt-1 text-sm text-slate-500">See which leads and quotations are at risk before revenue is lost.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Sign in to your workspace</h2>
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          New to SalesLeak?{" "}
          <Link href="/signup" className="font-medium text-slate-700 underline underline-offset-2">
            Create a company workspace
          </Link>
        </p>

        {showDemoAccounts && demoUsers.length > 0 && (
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
        )}
      </div>
    </div>
  );
}

function labelizeRole(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
