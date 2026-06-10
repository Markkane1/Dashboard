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
import { headers } from "next/headers";
import { getTranslationsServer } from "@/shared/i18n-server";

export default async function DashboardPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    redirect("/auth/login");
  }

  const locale = headers().get("x-next-locale") || "en";
  const t = getTranslationsServer(locale);

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
    { key: "overview", label: t("dashboard.overview") },
    { key: "courses", label: t("dashboard.myCourses") },
    { key: "certificates", label: t("dashboard.certificates") },
  ];

  const stats = [
    { name: t("dashboard.active"), value: inProgressIds.length },
    { name: t("common.completed"), value: completedIds.length },
    { name: t("dashboard.averageProgress"), value: `${averageProgress}%` },
  ];

  return (
    <PageShell>
      <PageHeader
        title={`${t("common.welcomeBack")}, ${session.user.name}`}
        description={t("dashboard.desc")}
        actions={(
          <Link href="/courses" className="btn-primary">
            {t("common.browseCatalog")}
          </Link>
        )}
      />

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row" role="tablist" aria-label="Dashboard sections">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/dashboard?section=${tab.key}`}
              role="tab"
              aria-selected={section === tab.key}
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
                  <h2 className="text-lg font-black text-slate-950">{t("dashboard.learningSnapshot")}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{t("dashboard.snapshotDesc")}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{t("dashboard.activeCourses")}</p>
                    <p className="mt-2 text-3xl font-black text-slate-950">{inProgressCourses.length}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{t("dashboard.coursesCompleted")}</p>
                    <p className="mt-2 text-3xl font-black text-slate-950">{completedCourses.length}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/courses" className="btn-secondary">
                    {t("common.browseCatalog")}
                  </Link>
                  <Link href="/diploma" className="btn-primary">
                    {t("dashboard.viewDiploma")}
                  </Link>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950">{t("dashboard.diplomaPathways")}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{t("dashboard.pathwaysDesc")}</p>
                </div>
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-forest">{completedIds.length} {t("common.completed")}</span>
              </div>
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <p>{t("dashboard.pathwaysTrack")}</p>
                <p className="font-semibold text-slate-900">{t("dashboard.pathwaysNeedFull")}</p>
              </div>
            </DashboardCard>
          </section>

          {inProgressCourses.length > 0 && (
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950">{t("dashboard.continueLearning")}</h2>
                  <p className="text-sm font-semibold text-slate-500">{t("dashboard.jumpBack")}</p>
                </div>
                <Link href="/dashboard?section=courses" className="btn-secondary">
                  {t("dashboard.viewAll")}
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {inProgressCourses.slice(0, 3).map((course) => {
                  const percentComplete = progressByCourseId.get(course.id) ?? 0;

                  return (
                    <CourseCard key={course.id} course={course}>
                      {!course.isExternal ? (
                        <Link href={`/courses/${course.id}/learn`} className="btn-primary mt-4 w-full">
                          {t("dashboard.continueLearning")}
                        </Link>
                      ) : null}
                      <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                          <span>{t("common.progress")}</span>
                          <span className="text-teal-700">{percentComplete}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-teal-700" style={{ width: `${percentComplete}%` }} />
                        </div>
                      </div>
                    </CourseCard>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {section === "courses" && (
        <>
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">{t("dashboard.continueLearning")}</h2>
                <p className="text-sm font-semibold text-slate-500">{inProgressCourses.length} {t("dashboard.activeCourses")}</p>
              </div>
            </div>

            {inProgressCourses.length === 0 ? (
              <EmptyState
                title={t("dashboard.noActive")}
                description={t("dashboard.noActiveDesc")}
                actions={(
                  <Link href="/courses" className="btn-primary">
                    {t("common.browseCatalog")}
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
                          {t("dashboard.continueLearning")}
                        </Link>
                      )}

                      <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                          <span>{t("common.progress")}</span>
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
                <h2 className="text-lg font-black text-slate-950">{t("dashboard.completedCourses")}</h2>
                <p className="text-sm font-semibold text-slate-500">{completedCourses.length} {t("dashboard.completedCourses")}</p>
              </div>
            </div>

            {completedCourses.length === 0 ? (
              <EmptyState
                title={t("dashboard.noCompleted")}
                description={t("dashboard.noCompletedDesc")}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {completedCourses.map((course) => (
                  <CourseCard key={course.id} course={course}>
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <span className="inline-flex rounded-md bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700">
                        {t("common.completed")}
                      </span>
                      <DownloadCertificateButton courseId={course.id} />
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
              title={t("dashboard.noCertificates")}
              description={t("dashboard.noCertificatesDesc")}
              actions={(
                <Link href="/courses" className="btn-primary">
                  {t("common.browseCatalog")}
                </Link>
              )}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {completedCourses.map((course) => (
                <CourseCard key={course.id} course={course}>
                  <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4">
                    <DownloadCertificateButton courseId={course.id} />
                    <span className="text-sm font-semibold text-slate-600">{t("dashboard.certAvailable")}</span>
                  </div>
                </CourseCard>
              ))}
            </div>
          )}

          <DashboardCard className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">{t("dashboard.diplomaPathways")}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{t("dashboard.pathwaysTrack")}</p>
              </div>
              <Link href="/diploma" className="btn-secondary">
                {t("dashboard.viewDiploma")}
              </Link>
            </div>
          </DashboardCard>
        </section>
      )}
    </PageShell>
  );
}
