import { getNotificationsForUser } from "@/server/data/notifications";
import { NotificationBell } from "@/components/header/NotificationBell";
import { ProfileMenu } from "@/components/header/ProfileMenu";
import { GlobalSearch } from "@/components/header/GlobalSearch";
import type { AuthSession } from "@/server/auth/session";

export async function AppHeader({ session }: { session: AuthSession }) {
  const notifications = await getNotificationsForUser(session.companyId, session.userId);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 sm:px-8">
      <GlobalSearch />
      <div className="flex items-center gap-3">
        <NotificationBell notifications={notifications} />
        <ProfileMenu name={session.name} role={session.role} />
      </div>
    </div>
  );
}
