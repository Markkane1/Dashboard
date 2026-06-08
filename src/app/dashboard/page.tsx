import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { findUserByEmail } from "@/features/users/data/userDb";
import { fetchCoursesByIds } from "@/infrastructure/api/courses";
import { fetchCourseProgressSummary } from "@/infrastructure/api/progress";
import CourseCard from "@/features/courses/components/CourseCard";
import { Link } from "@/shared/navigation";
import { logger } from "@/shared/logger";
import {
  DashboardCard,
  EmptyState,
  PageHeader,
  PageShell,
  StatCard,
} from "@/shared/components/ui/DesignSystem";
import {
  MarkCompleteButton,
  UnenrollButton,
  DownloadCertificateButton,
} from "@/features/users/components/DashboardActions";

export default async function DashboardPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    redirect("/auth/login");
  }

  const token = session.apiAccessToken;
  const user = await findUserByEmail(session.user.email);
  const enrolledIds = user?.enrolledCourses || [];
  const completedIds = user?.completedCourses || [];
  const inProgressIds = enrolledIds.filter((id) => !completedIds.includes(id));
  const dashboardCourseIds = [...new Set([...inProgressIds, ...completedIds])];
  const courses = await fetchCoursesByIds(dashboardCourseIds);
  const inProgressCourses = courses.filter((course) => inProgressIds.includes(course.id));
  const completedCourses = courses.filter((course) => completedIds.includes(course.id));
  const progressSummaries = token
    ? await Promise.all(
        inProgressIds.map(async (courseId) => {
          try {
            const summary = await fetchCourseProgressSummary(courseId, token);
            return [courseId, summary.percentComplete] as const;
          } catch (error) {
            logger.error(`Failed to fetch dashboard progress for course ${courseId}:`, error);
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

  const section = typeof searchParams.section === "string" ? searchParams.section : "overview";
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "courses", label: "My courses" },
    { key: "certificates", label: "Certificates" },
  ];

  const stats = [
    { name: "Active", value: inProgressIds.length },
    { name: "Completed", value: completedIds.length },
    { name: "Average progress", value: `${averageProgress}%` },
  ];

  return (
    <PageShell>
      <PageHeader
        title={`Welcome back, ${session.user.name}`}
        description="Track current courses, completion status, and certificate actions."
        actions={(
          <Link href="/courses" className="btn-primary">
            Browse courses
          </Link>
        )}
      />

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/dashboard?section=${tab.key}`}
              className={`whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-black transition ${section === tab.key ? "bg-forest text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {section === "overview" && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.name} title={stat.name} value={stat.value} />
            ))}
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <DashboardCard className="p-6">
              <div className="flex flex-col gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Learning snapshot</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Get a quick view of active progress and recent completions.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Active courses</p>
                    <p className="mt-2 text-3xl font-black text-slate-950">{inProgressCourses.length}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Courses completed</p>
                    <p className="mt-2 text-3xl font-black text-slate-950">{completedCourses.length}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/courses" className="btn-secondary">
                    Browse courses
                  </Link>
                  <Link href="/diploma" className="btn-primary">
                    View diploma progress
                  </Link>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Diploma pathways</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Review multi-course requirements and eligibility for your diploma.</p>
                </div>
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-forest">{completedIds.length} complete</span>
              </div>
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <p>Track your diploma progress across required courses and download your certificate when eligible.</p>
                <p className="font-semibold text-slate-900">Need a full diploma view? Open the diploma page.</p>
              </div>
            </DashboardCard>
          </section>
        </>
      )}

      {section === "courses" && (
        <>
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">Continue learning</h2>
                <p className="text-sm font-semibold text-slate-500">{inProgressCourses.length} active course(s)</p>
              </div>
            </div>

            {inProgressCourses.length === 0 ? (
              <EmptyState
                title="No active courses"
                description="Enroll in a course to start tracking progress here."
                actions={(
                  <Link href="/courses" className="btn-primary">
                    Browse catalog
                  </Link>
                )}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {inProgressCourses.map((course) => {
                  const percentComplete = progressByCourseId.get(course.id) ?? 0;

                  return (
                    <CourseCard key={course.id} course={course}>
                      {!course.isExternal && (
                        <Link href={`/courses/${course.id}/learn`} className="btn-secondary mt-4 w-full">
                          Continue learning
                        </Link>
                      )}

                      <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                          <span>Progress</span>
                          <span className="text-teal-700">{percentComplete}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-teal-700" style={{ width: `${percentComplete}%` }} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <MarkCompleteButton courseId={course.id} />
                        <UnenrollButton courseId={course.id} />
                      </div>
                    </CourseCard>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">Completed courses</h2>
                <p className="text-sm font-semibold text-slate-500">{completedCourses.length} completed courses</p>
              </div>
            </div>

            {completedCourses.length === 0 ? (
              <EmptyState
                title="No completed courses yet"
                description="Complete courses to access certificates and achievements."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {completedCourses.map((course) => (
                  <CourseCard key={course.id} course={course}>
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <span className="inline-flex rounded-md bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700">
                        Completed
                      </span>
                      <DownloadCertificateButton downloadUrl={`/api/certificates/${course.id}/download`} />
                    </div>
                  </CourseCard>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {section === "certificates" && (
        <section className="mt-6 space-y-6">
          {completedCourses.length === 0 ? (
            <EmptyState
              title="No certificates earned yet"
              description="Complete a course to generate your first certificate."
              actions={(
                <Link href="/courses" className="btn-primary">
                  Browse courses
                </Link>
              )}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {completedCourses.map((course) => (
                <CourseCard key={course.id} course={course}>
                  <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4">
                    <DownloadCertificateButton downloadUrl={`/api/certificates/${course.id}/download`} />
                    <span className="text-sm font-semibold text-slate-600">Certificate available for download.</span>
                  </div>
                </CourseCard>
              ))}
            </div>
          )}

          <DashboardCard className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">Diploma pathway</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">View diploma eligibility and download your diploma certificate when ready.</p>
              </div>
              <Link href="/diploma" className="btn-secondary">
                View diploma progress
              </Link>
            </div>
          </DashboardCard>
        </section>
      )}
    </PageShell>
  );
}
