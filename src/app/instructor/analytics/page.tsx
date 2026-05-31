import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { fetchManageableCourses } from "@/infrastructure/api/admin";
import InstructorAnalyticsPanel from "@/features/admin/components/InstructorAnalyticsPanel";
import { hasPermission, PERMISSIONS } from "@/shared/permissions";

export default async function InstructorAnalyticsPage() {
  const session = await auth();
  if (!session?.user || !session.apiAccessToken || !hasPermission(session.user, PERMISSIONS.VIEW_ANALYTICS)) {
    redirect("/dashboard");
  }

  const courses = await fetchManageableCourses(session.apiAccessToken);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-wider text-forest">Instructor analytics</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Course performance dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          View enrollments, completion rates, quarterly active learners, and quiz performance for your managed courses.
        </p>
      </div>
      {courses.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-600">
          No courses are currently assigned to your account. Create course content first, then return to analytics.
        </div>
      ) : (
        <InstructorAnalyticsPanel courses={courses} />
      )}
    </main>
  );
}
