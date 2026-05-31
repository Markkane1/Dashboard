import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { fetchNotifications } from "@/infrastructure/api/notifications";
import { Link } from "@/shared/navigation";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.apiAccessToken) {
    redirect("/auth/login");
  }

  const notifications = await fetchNotifications(session.apiAccessToken, 40);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-wider text-forest">Updates</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Notifications</h1>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {notifications.length === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-slate-500">No notifications yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notification) => (
              <div key={notification.id} className="p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">{notification.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
                  </div>
                  {!notification.readAt && (
                    <span className="w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-forest">New</span>
                  )}
                </div>
                {notification.linkUrl && (
                  <Link href={notification.linkUrl} className="mt-3 inline-block text-sm font-black text-ocean hover:text-forest">
                    Open
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
