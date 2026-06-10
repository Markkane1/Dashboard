import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { fetchManageableCourses } from "@/infrastructure/api/admin";
import VideoUploadForm from "@/features/lessons/components/VideoUploadForm";
import { hasPermission, PERMISSIONS } from "@/shared/permissions";
import { EmptyState, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";
import { Link } from "@/shared/navigation";

export default async function InstructorVideosPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/login");
  }

  if (!hasPermission(session.user, PERMISSIONS.MANAGE_CONTENT)) {
    redirect("/dashboard");
  }

  const token = session.apiAccessToken;
  if (!token) {
    redirect("/auth/login");
  }

  const courses = await fetchManageableCourses(token, {
    limit: 50,
    isExternal: false,
    isDiploma: false,
  });

  return (
    <PageShell>
      <PageHeader
        title="Video uploads"
        description="Attach MP4 videos to lessons and update lesson playback details for your managed courses."
        actions={(
          <Link href="/instructor/content" className="btn-secondary">
            Course content
          </Link>
        )}
      />

      {courses.length === 0 ? (
        <EmptyState
          title="No upload-ready courses"
          description="No internal courses are available for uploads yet. Create course content first, then return here."
          actions={(
            <Link href="/instructor/content" className="btn-primary">
              Manage courses
            </Link>
          )}
        />
      ) : (
        <VideoUploadForm courses={courses} />
      )}
    </PageShell>
  );
}
