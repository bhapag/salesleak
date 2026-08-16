import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AppHeader } from "@/components/header/AppHeader";
import { requireSession } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  if (session.role === "OWNER") {
    const company = await prisma.company.findFirst({ where: { id: session.companyId }, select: { onboardedAt: true } });
    if (!company?.onboardedAt) redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <Sidebar companyName={session.companyName} role={session.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader session={session} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
