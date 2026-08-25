import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AppHeader } from "@/components/header/AppHeader";
import { SubscriptionBanner } from "@/components/billing/SubscriptionBanner";
import { requireSession } from "@/server/auth/session";
import { getSubscriptionState } from "@/server/billing/entitlements";
import { prisma } from "@/lib/prisma";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  if (session.role === "OWNER") {
    const company = await prisma.company.findFirst({ where: { id: session.companyId }, select: { onboardedAt: true } });
    if (!company?.onboardedAt) redirect("/onboarding");
  }

  const subscriptionState = await getSubscriptionState(session.companyId);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <a
        href="#main-content"
        className="fixed left-2 top-2 z-[60] -translate-y-16 rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-brand-warm-white transition-transform duration-(--dur-micro) focus-visible:translate-y-0"
      >
        Skip to content
      </a>
      <Sidebar companyName={session.companyName} role={session.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader session={session} />
        <SubscriptionBanner state={subscriptionState} isOwner={session.role === "OWNER"} />
        <div id="main-content" className="min-w-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
