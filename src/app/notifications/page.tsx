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
        <div className="divide-y divide-[#e3e6f0] bg-white shadow-[0_0.15rem_1.75rem_0_rgba(58,59,69,0.15)] rounded-lg">
          {notifications.map((notification) => (
            <div key={notification.id} className="p-4 sm:p-5 hover:bg-[#f8f9fc] transition-colors">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#5a5c69]">{notification.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#858796]">{notification.message}</p>
                </div>
                {!notification.readAt && (
                  <span className="w-fit rounded px-2 py-1 bg-[#1cc88a] text-[10px] font-bold text-white uppercase tracking-wider">New</span>
                )}
              </div>
              {notification.linkUrl && (
                <Link href={notification.linkUrl} className="mt-3 inline-flex text-sm font-bold text-[#4e73df] hover:text-[#2e59d9] transition-colors">
                  Open &rarr;
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
