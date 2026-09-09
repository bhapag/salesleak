import type { Metadata } from "next";
import { requireSession } from "@/server/auth/session";
import { canManageTeam } from "@/server/auth/permissions";
import { NotAuthorized } from "@/components/auth/NotAuthorized";
import { PageHeader } from "@/components/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { Card } from "@/components/ui";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { labelize } from "@/lib/format";

export const metadata: Metadata = { title: "Account" };

export default async function AccountSettingsPage() {
  const session = await requireSession();
  if (!canManageTeam(session.role)) {
    return <NotAuthorized message="Settings are visible to the Owner and Sales Managers." />;
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Account" subtitle="Your sign-in details for this workspace." />
      <SettingsNav role={session.role} />

      <main className="px-4 py-6 sm:px-8">
        <div className="max-w-2xl">
          <Card title="Your account" description="Managed by your workspace Owner — contact them to change your name, email, or role.">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-400">Name</dt>
                <dd className="text-sm text-slate-800">{session.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Email</dt>
                <dd className="text-sm text-slate-800">{session.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Role</dt>
                <dd className="text-sm text-slate-800">{labelize(session.role)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Workspace</dt>
                <dd className="text-sm text-slate-800">{session.companyName}</dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="mb-2 text-xs font-medium text-slate-500">Session</p>
              <LogoutButton />
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
