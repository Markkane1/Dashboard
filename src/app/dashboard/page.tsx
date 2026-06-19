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
  UnenrollButton,
  DownloadCertificateButton,
} from "@/features/users/components/DashboardActions";
import { headers } from "next/headers";
import { getTranslationsServer } from "@/shared/i18n-server";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = await searchParams;
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    redirect("/auth/login");
  }

  const locale = (await headers()).get("x-next-locale") || "en";
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
  const canContinueCourse = (course: { isExternal?: boolean; isDiploma?: boolean; lessonsCount?: number }) =>
    !course.isExternal && !course.isDiploma && Number(course.lessonsCount || 0) > 0;
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

  const section = typeof resolvedSearchParams.section === "string" ? resolvedSearchParams.section : "overview";
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

      <div className="mb-6 bg-white shadow-[0_0.15rem_1.75rem_0_rgba(58,59,69,0.15)] rounded-lg p-3">
        <div className="flex flex-col gap-2 sm:flex-row" role="tablist" aria-label="Dashboard sections">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/dashboard?section=${tab.key}`}
              role="tab"
              aria-selected={section === tab.key}
              className={`whitespace-nowrap rounded px-4 py-2 text-sm font-bold transition ${section === tab.key ? "bg-[#4e73df] text-white" : "text-[#858796] hover:bg-[#f8f9fc]"}`}
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
                  <div className="rounded bg-[#f8f9fc] border border-[#e3e6f0] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#858796]">{t("dashboard.activeCourses")}</p>
                    <p className="mt-2 text-3xl font-bold text-[#5a5c69]">{inProgressCourses.length}</p>
                  </div>
                  <div className="rounded bg-[#f8f9fc] border border-[#e3e6f0] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#858796]">{t("dashboard.coursesCompleted")}</p>
                    <p className="mt-2 text-3xl font-bold text-[#5a5c69]">{completedCourses.length}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/courses" className="bg-white border border-[#e3e6f0] hover:bg-[#f8f9fc] text-[#5a5c69] font-bold py-2 px-4 rounded transition-colors text-sm">
                    {t("common.browseCatalog")}
                  </Link>
                  <Link href="/diploma" className="bg-[#4e73df] hover:bg-[#2e59d9] text-white font-bold py-2 px-4 rounded transition-colors text-sm">
                    {t("dashboard.viewDiploma")}
                  </Link>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#5a5c69]">{t("dashboard.diplomaPathways")}</h2>
                  <p className="mt-1 text-sm text-[#858796]">{t("dashboard.pathwaysDesc")}</p>
                </div>
                <span className="inline-flex rounded px-3 py-1 text-xs font-bold bg-[#1cc88a] text-white">{completedIds.length} {t("common.completed")}</span>
              </div>
              <div className="mt-5 space-y-3 text-sm text-[#858796]">
                <p>{t("dashboard.pathwaysTrack")}</p>
                <p className="font-bold text-[#5a5c69]">{t("dashboard.pathwaysNeedFull")}</p>
              </div>
            </DashboardCard>
          </section>

          {inProgressCourses.length > 0 && (
            <section className="mt-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#5a5c69]">{t("dashboard.continueLearning")}</h2>
                  <p className="text-sm text-[#858796]">{t("dashboard.jumpBack")}</p>
                </div>
                <Link href="/dashboard?section=courses" className="text-sm font-bold text-[#4e73df] hover:text-[#2e59d9] transition-colors">
                  {t("dashboard.viewAll")} &rarr;
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {inProgressCourses.slice(0, 3).map((course) => {
                  const percentComplete = progressByCourseId.get(course.id) ?? 0;

                  return (
                    <CourseCard key={course.id} course={course}>
                      {canContinueCourse(course) ? (
                        <Link href={`/courses/${course.id}/learn`} className="block text-center bg-[#4e73df] hover:bg-[#2e59d9] text-white font-bold py-2 px-4 rounded mt-4 w-full transition-colors text-sm">
                          {t("dashboard.continueLearning")}
                        </Link>
                      ) : null}
                      <div className="mt-4 space-y-2 border-t border-[#e3e6f0] pt-4">
                        <div className="flex justify-between text-xs font-bold text-[#858796]">
                          <span>{t("common.progress")}</span>
                          <span className="text-[#1cc88a]">{percentComplete}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded bg-[#eaecf4]">
                          <div className="h-full bg-[#1cc88a]" style={{ width: `${percentComplete}%` }} />
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
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#5a5c69]">{t("dashboard.continueLearning")}</h2>
                <p className="text-sm text-[#858796]">{inProgressCourses.length} {t("dashboard.activeCourses")}</p>
              </div>
            </div>

            {inProgressCourses.length === 0 ? (
              <EmptyState
                title={t("dashboard.noActive")}
                description={t("dashboard.noActiveDesc")}
                actions={(
                  <Link href="/courses" className="bg-[#4e73df] hover:bg-[#2e59d9] text-white font-bold py-2 px-4 rounded transition-colors text-sm">
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
                      {canContinueCourse(course) && (
                        <Link href={`/courses/${course.id}/learn`} className="block text-center bg-white border border-[#e3e6f0] hover:bg-[#f8f9fc] text-[#5a5c69] font-bold py-2 px-4 rounded mt-4 w-full transition-colors text-sm">
                          {t("dashboard.continueLearning")}
                        </Link>
                      )}

                      <div className="mt-4 space-y-2 border-t border-[#e3e6f0] pt-4">
                        <div className="flex justify-between text-xs font-bold text-[#858796]">
                          <span>{t("common.progress")}</span>
                          <span className="text-[#1cc88a]">{percentComplete}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded bg-[#eaecf4]">
                          <div className="h-full bg-[#1cc88a]" style={{ width: `${percentComplete}%` }} />
                        </div>
                      </div>

                      <div className="mt-4">
                        <UnenrollButton courseId={course.id} />
                      </div>
                    </CourseCard>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#5a5c69]">{t("dashboard.completedCourses")}</h2>
                <p className="text-sm text-[#858796]">{completedCourses.length} {t("dashboard.completedCourses")}</p>
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
                    <div className="mt-4 border-t border-[#e3e6f0] pt-4">
                      <span className="inline-flex rounded bg-[#1cc88a] px-2 py-1 text-xs font-bold text-white mb-2">
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
                <Link href="/courses" className="bg-[#4e73df] hover:bg-[#2e59d9] text-white font-bold py-2 px-4 rounded transition-colors text-sm">
                  {t("common.browseCatalog")}
                </Link>
              )}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {completedCourses.map((course) => (
                <CourseCard key={course.id} course={course}>
                  <div className="mt-4 flex flex-col gap-3 border-t border-[#e3e6f0] pt-4">
                    <DownloadCertificateButton courseId={course.id} />
                    <span className="text-sm text-[#858796]">{t("dashboard.certAvailable")}</span>
                  </div>
                </CourseCard>
              ))}
            </div>
          )}

          <DashboardCard className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#5a5c69]">{t("dashboard.diplomaPathways")}</h2>
                <p className="mt-1 text-sm text-[#858796]">{t("dashboard.pathwaysTrack")}</p>
              </div>
              <Link href="/diploma" className="bg-white border border-[#e3e6f0] hover:bg-[#f8f9fc] text-[#5a5c69] font-bold py-2 px-4 rounded transition-colors text-sm">
                {t("dashboard.viewDiploma")}
              </Link>
            </div>
          </DashboardCard>
        </section>
      )}
    </PageShell>
  );
}
