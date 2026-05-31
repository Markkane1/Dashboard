import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { findUserByEmail } from "@/features/users/data/userDb";
import { fetchCourses } from "@/infrastructure/api/courses";
import { Course } from "@/shared/types";
import { Link } from "@/shared/navigation";
import { AuthenticatedDownloadButton } from "@/features/users/components/DashboardActions";

function getRequiredCourses(diploma: Course, courses: Course[]) {
  if (diploma.diplomaRequiredCourseIds && diploma.diplomaRequiredCourseIds.length > 0) {
    return courses.filter((course) => diploma.diplomaRequiredCourseIds!.includes(course.id));
  }

  return courses.filter(
    (course) => course.category === diploma.category && !course.isDiploma && !course.isExternal
  );
}

export default async function DiplomaPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/login");
  }

  const user = await findUserByEmail(session.user.email);
  const completedCourseIds = user?.completedCourses || [];
  const courses = await fetchCourses();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";
  const diplomaTracks = courses.filter((course) => course.isDiploma);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200 sm:p-8">
        <p className="text-xs font-black uppercase tracking-wider text-amber-700">Specialist Diplomas</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Complete multi-course pathways
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-slate-700">
          Finish every required course in a diploma track, then download your diploma PDF from this page.
        </p>
      </div>

      {diplomaTracks.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-600 sm:p-8">
          No diploma tracks are currently configured.
        </div>
      ) : (
        <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-2">
          {diplomaTracks.map((diploma) => {
            const requiredCourses = getRequiredCourses(diploma, courses);
            const completedRequired = requiredCourses.filter((course) => completedCourseIds.includes(course.id));
            const isEligible = requiredCourses.length > 0 && completedRequired.length === requiredCourses.length;
            const percent = requiredCourses.length > 0
              ? Math.round((completedRequired.length / requiredCourses.length) * 100)
              : 0;

            return (
              <section key={diploma.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                      Diploma Track
                    </span>
                    <h2 className="mt-4 text-xl font-black text-slate-950">{diploma.title}</h2>
                  </div>
                  <span className="text-sm font-black text-forest">{percent}% complete</span>
                </div>

                <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
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
                      downloadUrl={`${apiUrl}/api/docs/diploma?diplomaId=${diploma.id}`}
                      label="Download Diploma"
                      fallbackFilename="diploma.pdf"
                      className="inline-flex rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-amber-700"
                    />
                  ) : (
                    <Link
                      href="/courses"
                      className="inline-flex items-center justify-center rounded-lg bg-forest px-5 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-800"
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
    </main>
  );
}
