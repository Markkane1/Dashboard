import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { findUserByEmail } from "@/features/users/data/userDb";
import { fetchCoursesByIds } from "@/infrastructure/api/courses";
import { fetchCourseProgressSummary } from "@/infrastructure/api/progress";
import CourseCard from "@/features/courses/components/CourseCard";
import { Link } from "@/shared/navigation";
import {
  MarkCompleteButton,
  UnenrollButton,
  DownloadCertificateButton,
} from "@/features/users/components/DashboardActions";

export default async function DashboardPage() {
  // Get active session securely on the server
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    redirect("/auth/login");
  }
  const token = session.apiAccessToken;

  // Look up user from the shared MongoDB user repository
  const user = await findUserByEmail(session.user.email);
  const enrolledIds = user?.enrolledCourses || [];
  const completedIds = user?.completedCourses || [];

  // Filter in-progress courses (enrolled but not completed)
  const inProgressIds = enrolledIds.filter((id) => !completedIds.includes(id));

  const dashboardCourseIds = [...new Set([...inProgressIds, ...completedIds])];
  const courses = await fetchCoursesByIds(dashboardCourseIds);
  const inProgressCourses = courses.filter((c) => inProgressIds.includes(c.id));
  const completedCourses = courses.filter((c) => completedIds.includes(c.id));
  const progressSummaries = token
    ? await Promise.all(
        inProgressIds.map(async (courseId) => {
          try {
            const summary = await fetchCourseProgressSummary(courseId, token);
            return [courseId, summary.percentComplete] as const;
          } catch (error) {
            console.error(`Failed to fetch dashboard progress for course ${courseId}:`, error);
            return [courseId, 0] as const;
          }
        })
      )
    : [];
  const progressByCourseId = new Map(progressSummaries);
  const averageProgress = inProgressIds.length > 0
    ? Math.round(progressSummaries.reduce((total, [, percent]) => total + percent, 0) / inProgressIds.length)
    : completedIds.length > 0
      ? 100
      : 0;

  const stats = [
    { name: "Active courses", value: inProgressIds.length, label: "In progress" },
    { name: "Courses completed", value: completedIds.length, label: "Completed" },
    { name: "Average progress", value: `${averageProgress}%`, label: "Current pace" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
      
      {/* 1. Welcome Header */}
      <div className="rounded-2xl bg-gradient-to-r from-forest to-emerald-800 p-8 text-white shadow-sm lg:p-10 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 text-9xl font-bold select-none translate-y-12 translate-x-4">
          EPA
        </div>
        <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
          Your Learning Journey
        </span>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
          Welcome back, {session.user.name}
        </h1>
        <p className="mt-3 max-w-xl text-emerald-100 text-sm leading-relaxed font-semibold">
          Expand your environmental law literacy at your own pace. Monitor your enrollment targets and download certifications once paths are complete.
        </p>
      </div>

      {/* 2. Stats Row */}
      <div className="grid gap-5 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 flex items-center justify-between gap-4"
          >
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-slate-500">{stat.name}</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{stat.value}</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-forest">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* 3. In Progress Section */}
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950 flex items-center gap-2">
          Continue learning
        </h2>
        
        {inProgressCourses.length === 0 ? (
          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-10 text-center">
            <span className="text-4xl">🌱</span>
            <h3 className="mt-3 text-lg font-bold text-slate-800">You have not enrolled in any courses yet.</h3>
            <p className="mt-1 text-sm text-slate-500">Explore the course catalog to enroll in our free environmental legal programs.</p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-md bg-forest px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-800 transition-colors shadow-sm"
            >
              Browse catalog
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {inProgressCourses.map((course) => {
              const percentComplete = progressByCourseId.get(course.id) ?? 0;

              return (
                <CourseCard key={course.id} course={course}>
                  {!course.isExternal && (
                    <Link
                      href={`/courses/${course.id}/learn`}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-ocean px-4 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#0b5366] focus:outline-none focus:ring-2 focus:ring-ocean focus:ring-offset-2"
                    >
                      Continue learning &rarr;
                    </Link>
                  )}
                  
                  <div className="mt-5 border-t border-slate-100 pt-4 space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Course Progress</span>
                      <span className="text-forest">{percentComplete}% Complete</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-forest rounded-full" style={{ width: `${percentComplete}%` }} />
                    </div>
                  </div>

                  {/* Dashboard Action buttons */}
                  <div className="mt-4 flex w-full flex-col gap-2 pt-1 sm:flex-row">
                    <MarkCompleteButton courseId={course.id} />
                    <UnenrollButton courseId={course.id} />
                  </div>

                </CourseCard>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Completed Section */}
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950 flex items-center gap-2">
          Completed courses
        </h2>

        {completedCourses.length === 0 ? (
          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-8 text-center text-sm font-semibold text-slate-500">
            Completed courses and earned certificates will be displayed here.
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {completedCourses.map((course) => (
              <CourseCard key={course.id} course={course}>
                
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-black text-forest">
                    <span>✓</span> Completed
                  </div>
                  
                  <DownloadCertificateButton downloadUrl={`/api/certificates/${course.id}/download`} />
                </div>

              </CourseCard>
            ))}
          </div>
        )}
      </div>

      {/* Diploma Pathways */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Specialist diploma pathways</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Track multi-course requirements and download eligible diploma PDFs.
            </p>
          </div>
          <Link
            href="/diploma"
            className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            View diploma progress
          </Link>
        </div>
      </div>

      {/* 5. Browse CTA Banner */}
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-8 text-center space-y-4">
        <span className="text-3xl">🌏</span>
        <h3 className="text-xl font-black text-slate-950">Discover more courses</h3>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-600 font-semibold">
          Expand your knowledge by browsing through our catalog entries mapped to United Nations standards, including biological diversity, chemical regulations, and climate litigation.
        </p>
        <Link
          href="/"
          className="inline-block rounded-md bg-forest px-6 py-3 text-sm font-black text-white hover:bg-emerald-800 transition-colors shadow-sm"
        >
          Browse catalog
        </Link>
      </div>

    </div>
  );
}
