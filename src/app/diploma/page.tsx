import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { findUserByEmail } from "@/features/users/data/userDb";
import { fetchCoursePage, fetchCoursesByIds } from "@/infrastructure/api/courses";
import { Course } from "@/shared/types";
import { Link } from "@/shared/navigation";
import { AuthenticatedDownloadButton } from "@/features/users/components/DashboardActions";
import { EmptyState, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

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
              <section key={diploma.id} className="bg-white shadow-[0_0.15rem_1.75rem_0_rgba(58,59,69,0.15)] rounded-lg min-w-0 mb-4 border border-[#e3e6f0]">
                <div className="p-5">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <span className="rounded bg-[#f6c23e] px-2 py-1 text-xs font-bold text-white mb-2 inline-block">
                        Diploma Track
                      </span>
                      <h2 className="mt-1 text-lg font-bold text-[#5a5c69]">{diploma.title}</h2>
                    </div>
                    <span className="text-sm font-bold text-[#1cc88a]">{percent}% complete</span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[#858796]">
                    {diploma.description || "Complete all required courses to unlock this specialist diploma."}
                  </p>

                  <div className="mt-5 h-2 w-full overflow-hidden rounded bg-[#eaecf4]">
                    <div className="h-full bg-[#1cc88a]" style={{ width: `${percent}%` }} />
                  </div>

                <div className="mt-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#858796]">
                    Required courses
                  </h3>
                  {trackRequiredCourses.length === 0 ? (
                    <p className="mt-3 rounded border border-[#e3e6f0] bg-[#f8f9fc] p-3 text-sm font-bold text-[#858796]">
                      No required courses are configured for this diploma yet.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {trackRequiredCourses.map((course) => {
                        const completed = completedCourseIds.includes(course.id);
                        return (
                          <li
                            key={course.id}
                            className="flex min-w-0 flex-col gap-2 rounded border border-[#e3e6f0] px-3 py-2 text-sm min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between"
                          >
                            <Link href={`/courses/${course.id}`} className="min-w-0 font-bold text-[#5a5c69] hover:text-[#4e73df] transition-colors">
                              {course.title}
                            </Link>
                            <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                              completed
                                ? "bg-[#1cc88a] text-white"
                                : "bg-[#f8f9fc] text-[#858796] border border-[#e3e6f0]"
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
                      className="bg-[#1cc88a] hover:bg-[#17a673] text-white font-bold py-2 px-4 rounded transition-colors text-sm"
                    />
                  ) : (
                    <Link
                      href="/courses"
                      className="bg-[#4e73df] hover:bg-[#2e59d9] text-white font-bold py-2 px-4 rounded transition-colors text-sm"
                    >
                      Continue pathway
                    </Link>
                  )}
                </div>
              </div>
              </section>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
