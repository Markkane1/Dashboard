import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import ContentManagerPanel from "@/features/admin/components/ContentManagerPanel";
import { fetchManageableCourses } from "@/infrastructure/api/admin";
import { Link } from "@/shared/navigation";
import { hasPermission, PERMISSIONS } from "@/shared/permissions";
import {
  PageHeader,
  PageShell,
} from "@/shared/components/ui/DesignSystem";

export default async function InstructorContentPage() {
  const session = await auth();
  if (!session?.user || !session.apiAccessToken || !hasPermission(session.user, PERMISSIONS.MANAGE_CONTENT)) {
    redirect("/dashboard");
  }

  const courses = await fetchManageableCourses(session.apiAccessToken);

  return (
    <PageShell>
      <PageHeader
        title="Content management"
        description="Manage courses from a dedicated list, then edit details, lessons, and quiz content one step at a time."
        actions={(
          <Link href="/instructor/analytics" className="btn-secondary">
            Analytics
          </Link>
        )}
      />

      <ContentManagerPanel token={session.apiAccessToken} courses={courses} />
    </PageShell>
  );
}
