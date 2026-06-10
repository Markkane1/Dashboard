import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { findUserByEmail } from "@/features/users/data/userDb";
import { fetchCoursePage, fetchCoursesByIds } from "@/infrastructure/api/courses";
import { Course } from "@/shared/types";
import { Link } from "@/shared/navigation";
import { AuthenticatedDownloadButton } from "@/features/users/components/DashboardActions";
import { DashboardCard, EmptyState, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

export default async function DiplomaPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/login");
  }

  const user = await findUserByEmail(session.user.email);
  const completedCourseIds = user?.completedCourses || [];

  const diplomaPage = await fetchCoursePage({ limit: 60, isDiploma: true });
  const diplomaTracks = diplomaPage.courses;
  const requiredCourseIds = diplomaTracks.flatMap((course) => course.diplomaRequiredCourseIds || []);
  const requiredCourses = requiredCourseIds.length > 0
    ? await fetchCoursesByIds(requiredCourseIds)
    : [];

  const categoriesWithoutRequirements = diplomaTracks
    .filter((course) => !course.diplomaRequiredCourseIds || course.diplomaRequiredCourseIds.length === 0)
    .map((course) => course.category)
    .filter(Boolean);

  const fallbackCoursesByCategory = new Map<string, Course[]>();
  if (categoriesWithoutRequirements.length > 0) {
    const fallbackPages = await Promise.all(
      categoriesWithoutRequirements.map((category) =>
        fetchCoursePage({ category, limit: 24, isDiploma: false, isExternal: false })
      )
    );

    fallbackPages.forEach((page, index) => {
      fallbackCoursesByCategory.set(categoriesWithoutRequirements[index], page.courses);
    });
  }

  const getRequiredCourses = (diploma: Course) => {
    if (diploma.diplomaRequiredCourseIds && diploma.diplomaRequiredCourseIds.length > 0) {
      return requiredCourses.filter((course) => diploma.diplomaRequiredCourseIds!.includes(course.id));
    }

    return fallbackCoursesByCategory.get(diploma.category) || [];
  };

  return (
    <PageShell>
      <PageHeader
        title="Diploma pathways"
        description="Finish required courses in a diploma track, then download the diploma PDF."
      />

      {diplomaTracks.length === 0 ? (
        <EmptyState
          title="No diploma tracks are currently configured"
          description="Check back later or browse the course catalog for additional learning pathways."
          actions={(
            <Link href="/courses" className="btn-primary">
              Browse courses
            </Link>
          )}
          className="mt-6"
        />
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {diplomaTracks.map((diploma) => {
            const trackRequiredCourses = getRequiredCourses(diploma);
            const completedRequired = trackRequiredCourses.filter((course) => completedCourseIds.includes(course.id));
            const isEligible = trackRequiredCourses.length > 0 && completedRequired.length === trackRequiredCourses.length;
            const percent = trackRequiredCourses.length > 0
              ? Math.round((completedRequired.length / trackRequiredCourses.length) * 100)
              : 0;

            return (
              <section key={diploma.id} className="dashboard-card min-w-0 p-4 sm:p-5">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-black text-amber-800">
                      Diploma Track
                    </span>
                    <h2 className="mt-3 text-lg font-black text-slate-950">{diploma.title}</h2>
                  </div>
                  <span className="text-sm font-black text-forest">{percent}% complete</span>
                </div>

                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                  {diploma.description || "Complete all required courses to unlock this specialist diploma."}
                </p>

                <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${percent}%` }} />
                </div>

                <div className="mt-5">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">
                    Required courses
                  </h3>
                  {requiredCourses.length === 0 ? (
                    <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                      No required courses are configured for this diploma yet.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {requiredCourses.map((course) => {
                        const completed = completedCourseIds.includes(course.id);
                        return (
                          <li
                            key={course.id}
                            className="flex min-w-0 flex-col gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between"
                          >
                            <Link href={`/courses/${course.id}`} className="min-w-0 font-bold text-slate-800 hover:text-forest">
                              {course.title}
                            </Link>
                            <span className={`shrink-0 rounded px-2 py-1 text-xs font-black ${
                              completed
                                ? "bg-emerald-50 text-forest"
                                : "bg-slate-100 text-slate-500"
                            }`}>
                              {completed ? "Completed" : "Pending"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {isEligible ? (
                    <AuthenticatedDownloadButton
                      downloadUrl={`/api/admin/docs/diploma?diplomaId=${encodeURIComponent(diploma.id)}`}
                      label="Download Diploma"
                      fallbackFilename="diploma.pdf"
                      className="btn-primary bg-amber-600 hover:bg-amber-700"
                    />
                  ) : (
                    <Link
                      href="/courses"
                      className="btn-primary"
                    >
                      Continue pathway
                    </Link>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

