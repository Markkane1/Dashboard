import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import AdminPanel from "@/features/admin/components/AdminPanel";
import { fetchAdminUsers, fetchAnalyticsOverview, fetchManageableCourses } from "@/infrastructure/api/admin";
import { hasPermission, PERMISSIONS } from "@/shared/permissions";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email || !session.apiAccessToken || !hasPermission(session.user, PERMISSIONS.MANAGE_USERS)) {
    redirect("/dashboard");
  }

  const [courses, users, analytics] = await Promise.all([
    fetchManageableCourses(session.apiAccessToken),
    fetchAdminUsers(session.apiAccessToken),
    fetchAnalyticsOverview(session.apiAccessToken),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-wider text-forest">Platform operations</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Admin panel</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Manage courses, lessons, roles, announcements, and learning analytics without touching MongoDB directly.
        </p>
      </div>
      <AdminPanel token={session.apiAccessToken} courses={courses} users={users} analytics={analytics} />
    </main>
  );
}
