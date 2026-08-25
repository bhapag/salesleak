import { prisma } from "@/lib/prisma";
import { WebsiteFormDemo } from "@/components/integrations/WebsiteFormDemo";

/**
 * Public, unauthenticated — this is what a company would embed on their own
 * website. Doubles as the local dev test form for the Website Forms
 * connector: it POSTs to the same /api/webhooks/website/[token] endpoint a
 * real embedded form would use, so testing this page IS testing the
 * connector end to end.
 */
export default async function WebsiteFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const integration = await prisma.integration.findFirst({
    where: { webhookToken: token, type: "WEBSITE" },
    include: { company: { select: { name: true } } },
  });

  if (!integration) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-card">
          <p className="text-sm font-medium text-slate-900">This form isn&apos;t available.</p>
          <p className="mt-1 text-xs text-slate-500">The link may be incorrect or no longer active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h1 className="text-lg font-semibold text-slate-900">Get in touch with {integration.company.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Tell us what you need and we&apos;ll get back to you.</p>
        <div className="mt-5">
          <WebsiteFormDemo token={token} />
        </div>
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Powered by SalesLeak · <span className="text-[#B08A45]">NobleArc</span>
        </p>
      </div>
    </div>
  );
}
