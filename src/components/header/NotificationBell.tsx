"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatRelativeToNow } from "@/lib/format";
import { markNotificationRead, markAllNotificationsRead } from "@/server/actions/notifications";
import { getNotificationHref } from "@/lib/notificationHref";

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: Date;
};

export function NotificationBell({ notifications }: { notifications: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  function handleOpen(notification: NotificationItem) {
    if (!notification.isRead) {
      startTransition(async () => {
        await markNotificationRead(notification.id);
      });
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-600 transition-colors duration-(--dur-micro) hover:bg-slate-100"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="dropdown-enter absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-dropdown sm:w-96">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {unreadCount > 0 && (
                <button type="button" onClick={handleMarkAll} disabled={pending} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications right now.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={getNotificationHref(n.entityType, n.entityId)}
                        onClick={() => handleOpen(n)}
                        className={`flex gap-2.5 px-4 py-3 hover:bg-slate-50 ${!n.isRead ? "bg-blue-50/40" : ""}`}
                      >
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.isRead ? "bg-blue-500" : "bg-transparent"}`} />
                        <div className="min-w-0">
                          <p className={`text-sm ${!n.isRead ? "font-medium text-slate-900" : "text-slate-600"}`}>{n.message}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{formatRelativeToNow(n.createdAt)}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M5 8a5 5 0 0110 0c0 3 1 4.5 1.5 5H3.5C4 12.5 5 11 5 8z" strokeLinejoin="round" />
      <path d="M8 16a2 2 0 004 0" strokeLinecap="round" />
    </svg>
  );
}
