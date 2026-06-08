import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { fetchManageableCourses } from "@/infrastructure/api/admin";
import InstructorAnalyticsPanel from "@/features/admin/components/InstructorAnalyticsPanel";
import { hasPermission, PERMISSIONS } from "@/shared/permissions";
import { DashboardCard, EmptyState, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";
import { Link } from "@/shared/navigation";

export default async function InstructorAnalyticsPage() {
  const session = await auth();
  if (!session?.user || !session.apiAccessToken || !hasPermission(session.user, PERMISSIONS.VIEW_ANALYTICS)) {
    redirect("/dashboard");
  }

  const courses = await fetchManageableCourses(session.apiAccessToken);

  return (
    <PageShell>
      <PageHeader
        title="Instructor analytics"
        description="View enrollments, completion rates, quarterly active learners, and quiz performance for your managed courses."
        actions={(
          <Link href="/instructor/content" className="btn-secondary">
            Course content
          </Link>
        )}
      />

      {courses.length === 0 ? (
        <EmptyState
          title="No analytics available"
          description="No courses are currently assigned to your account. Create course content first, then return to analytics."
          actions={(
            <Link href="/instructor/content" className="btn-primary">
              Manage courses
            </Link>
          )}
        />
      ) : (
        <DashboardCard className="p-6">
          <InstructorAnalyticsPanel courses={courses} />
        </DashboardCard>
      )}
    </PageShell>
  );
}
