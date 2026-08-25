import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { CsvImportWizard } from "@/components/leads/CsvImportWizard";

export default async function CsvImportPage() {
  const session = await requireSession();
  const users = await prisma.user.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } });

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-6 sm:px-8">
        <Link href="/leads" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Back to Leads
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Import Leads from CSV</h1>
        <p className="text-sm text-slate-500">Upload, map, preview, and import enquiries in bulk.</p>
      </header>

      <main className="px-4 py-6 sm:px-8">
        <div className="max-w-4xl">
          <CsvImportWizard users={users.map((u) => ({ id: u.id, name: u.name }))} />
        </div>
      </main>
    </div>
  );
}
