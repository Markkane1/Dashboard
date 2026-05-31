import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import ContentManagerPanel from "@/features/admin/components/ContentManagerPanel";
import { fetchManageableCourses } from "@/infrastructure/api/admin";
import { Link } from "@/shared/navigation";
import { hasPermission, PERMISSIONS } from "@/shared/permissions";

export default async function InstructorContentPage() {
  const session = await auth();
  if (!session?.user || !session.apiAccessToken || !hasPermission(session.user, PERMISSIONS.MANAGE_CONTENT)) {
    redirect("/dashboard");
  }

  const courses = await fetchManageableCourses(session.apiAccessToken);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-wider text-forest">Instructor tools</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Content management</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Create courses and lessons, then use the video uploader to attach lesson media.
        </p>
        <div className="mt-4">
          <Link
            href="/instructor/analytics"
            className="inline-flex rounded-md bg-forest px-4 py-2 text-sm font-black text-white hover:bg-emerald-800 transition-colors"
          >
            View course analytics
          </Link>
        </div>
      </div>
      <ContentManagerPanel token={session.apiAccessToken} courses={courses} />
    </main>
  );
}
