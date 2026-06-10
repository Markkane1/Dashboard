import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import AdminPanel from "@/features/admin/components/AdminPanel";
import { fetchAdminUsers, fetchAnalyticsOverview, fetchManageableCourses, fetchPermissionCatalog, fetchRoles } from "@/infrastructure/api/admin";
import { PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";
import { hasPermission, PERMISSIONS } from "@/shared/permissions";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email || !session.apiAccessToken || !hasPermission(session.user, PERMISSIONS.MANAGE_USERS)) {
    redirect("/dashboard");
  }

  const [users, analytics, roles, permissionCatalog, courses] = await Promise.all([
    fetchAdminUsers(session.apiAccessToken),
    fetchAnalyticsOverview(session.apiAccessToken),
    fetchRoles(session.apiAccessToken),
    fetchPermissionCatalog(session.apiAccessToken),
    fetchManageableCourses(session.apiAccessToken, { limit: 200 }),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Admin panel"
        description="Manage courses, lessons, roles, announcements, and learning analytics without touching MongoDB directly."
      />
      <AdminPanel token={session.apiAccessToken} users={users} analytics={analytics} roles={roles} permissionCatalog={permissionCatalog} courses={courses} />
    </PageShell>
  );
}
