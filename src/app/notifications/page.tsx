import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { fetchNotifications } from "@/infrastructure/api/notifications";
import { Link } from "@/shared/navigation";
import { EmptyState, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.apiAccessToken) {
    redirect("/auth/login");
  }

  const notifications = await fetchNotifications(session.apiAccessToken, 40);

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        description="Recent platform messages and course updates."
      />

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="Once there are updates for your account or courses, they’ll appear here."
        />
      ) : (
        <div className="divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white shadow-sm">
          {notifications.map((notification) => (
            <div key={notification.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">{notification.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
                </div>
                {!notification.readAt && (
                  <span className="w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-forest">New</span>
                )}
              </div>
              {notification.linkUrl && (
                <Link href={notification.linkUrl} className="mt-3 inline-flex text-sm font-black text-teal-700 hover:text-teal-800">
                  Open
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
