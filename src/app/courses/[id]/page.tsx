import { notFound } from "next/navigation";
import { Link } from "@/shared/navigation";
import CourseCard from "@/features/courses/components/CourseCard";
import EnrollButton from "@/features/enrollments/components/EnrollButton";
import { categories } from "@/features/courses/data/categories";
import { fetchCourseById, fetchCoursePage } from "@/infrastructure/api/courses";
import { auth } from "@/../auth";
import { findUserByEmail, checkCourseAccess } from "@/features/users/data/userDb";
import { Metadata } from "next";
import { Course } from "@/shared/types";
import {
  DashboardCard,
  EmptyState,
  PageHeader,
  PageShell,
  StatusBanner,
} from "@/shared/components/ui/DesignSystem";

export const dynamicParams = true;

interface CourseDetailPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
}

export async function generateMetadata({ params }: CourseDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  let course;
  try {
    course = await fetchCourseById(resolvedParams.id);
  } catch {
    return {
      title: "Course Not Found | EPA Elearning",
    };
  }
  return {
    title: `${course.title} | EPA Elearning`,
    description: course.description || "Environmental learning for multilateral environmental agreements",
    openGraph: {
      title: `${course.title} | EPA Elearning`,
      description: course.description || "Environmental learning for multilateral environmental agreements",
      type: "article",
      siteName: "EPA Elearning",
    },
    twitter: {
      card: "summary_large_image",
      title: `${course.title} | EPA Elearning`,
      description: course.description || "Environmental learning for multilateral environmental agreements",
    },
  };
}

export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  let course;
  try {
    course = await fetchCourseById(resolvedParams.id);
  } catch {
    notFound();
  }

  // Get session securely on the server
  const session = await auth();
  const isAuthenticated = !!session?.user;

  // Check enrollment
  let initialEnrolled = false;
  if (session?.user?.email) {
    const dbUser = await findUserByEmail(session.user.email);
    if (dbUser) {
      initialEnrolled = checkCourseAccess(dbUser, resolvedParams.id);
    }
  }

  // Category details
  const categoryObj = categories.find((item) => item.id === course.category);
  const categoryLabel = categoryObj?.label || course.category;
  const sectionLabels = course.mea || course.sections || [];
  const topics = course.topics || [];
  const quickFacts = [
    { label: "Instructor", value: course.instructorName || "EPA Punjab" },
    { label: "Duration", value: course.duration || "Self-paced" },
    { label: "Lessons", value: `${course.lessonsCount || 0} lessons` },
    { label: "Format", value: course.isExternal ? "External course" : course.isDiploma ? "Diploma pathway" : "Online course" },
  ];
  const canContinueLearning = !course.isExternal && !course.isDiploma && Number(course.lessonsCount || 0) > 0;

  let related: Course[] = [];
  try {
    const relatedPage = await fetchCoursePage({ category: course.category, limit: 5 });
    related = relatedPage.courses
      .filter((c) => c.category === course.category && c.id !== course.id)
      .slice(0, 4);
  } catch {}

  return (
    <PageShell>
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold text-[#858796]">
        <Link href="/courses" className="text-sm font-bold text-[#4e73df] hover:text-[#2e59d9] transition-colors">
          Courses
        </Link>
        <span>{" > "}</span>
        {categoryObj ? (
          <Link href={`/courses?category=${categoryObj.id}`} className="text-sm font-bold text-[#4e73df] hover:text-[#2e59d9] transition-colors">
            {categoryLabel}
          </Link>
        ) : (
          <span className="text-sm font-bold text-[#5a5c69]">{categoryLabel}</span>
        )}
        <span>{" > "}</span>
        <span className="min-w-0 max-w-full truncate text-sm text-[#5a5c69] sm:max-w-md">{course.title}</span>
      </nav>

      {resolvedSearchParams?.error === "not-enrolled" && (
        <StatusBanner
          variant="warning"
          title="Enroll to access the course lessons"
          description="You must enroll in this course before you can view the learning content."
        />
      )}

      <PageHeader
        title={course.title}
        description={course.description || "Preview the course summary, syllabus, and enrollment options below."}
        actions={(
          <div className="flex flex-wrap gap-3">
            <EnrollButton
              courseId={course.id}
              isAuthenticated={isAuthenticated}
              initialEnrolled={initialEnrolled}
              canContinueLearning={canContinueLearning}
            />
            {course.syllabusUrl && (
              <a href={course.syllabusUrl} target="_blank" rel="noopener noreferrer" className="bg-white border border-[#e3e6f0] hover:bg-[#f8f9fc] text-[#5a5c69] font-bold py-2 px-4 rounded transition-colors text-sm">
                View syllabus
              </a>
            )}
            {course.isExternal && course.externalUrl && (
              <a href={course.externalUrl} target="_blank" rel="noopener noreferrer" className="bg-[#4e73df] hover:bg-[#2e59d9] text-white font-bold py-2 px-4 rounded transition-colors text-sm">
                Open external course
              </a>
            )}
          </div>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <DashboardCard className="p-6">
          <div className="grid gap-5">
            <div className="flex flex-wrap gap-2">
              <span className="rounded bg-[#f8f9fc] border border-[#e3e6f0] px-3 py-1 text-xs font-bold text-[#858796]">{categoryLabel}</span>
              {course.isDiploma && (
                <span className="rounded bg-[#f6c23e] px-3 py-1 text-xs font-bold text-white">Diploma</span>
              )}
            </div>
            <div className="grid gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#858796]">SDGs</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {course.sdgGoals.map((goal) => (
                    <span key={goal} className="rounded bg-[#f8f9fc] border border-[#e3e6f0] px-3 py-1 text-xs font-bold text-[#858796]">SDG {goal}</span>
                  ))}
                </div>
              </div>
              {topics.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#858796]">Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {topics.map((item) => (
                      <span key={item} className="rounded bg-[#f8f9fc] border border-[#e3e6f0] px-3 py-1 text-xs font-bold text-[#858796]">{item.replace(/-/g, " ")}</span>
                    ))}
                  </div>
                </div>
              )}
              {sectionLabels.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#858796]">Sections</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sectionLabels.map((item) => (
                      <span key={item} className="rounded bg-[#f8f9fc] border border-[#e3e6f0] px-3 py-1 text-xs font-bold text-[#858796]">{item}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DashboardCard>

        <DashboardCard className="p-6">
          <div className="grid gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#5a5c69]">Course quick facts</h2>
              <p className="mt-1 text-sm text-[#858796]">Use this summary before enrolling.</p>
            </div>
            <dl className="grid gap-3">
              {quickFacts.map((fact) => (
                <div key={fact.label} className="rounded border border-[#e3e6f0] bg-[#f8f9fc] px-3 py-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-[#858796]">{fact.label}</dt>
                  <dd className="mt-1 text-sm font-bold text-[#5a5c69]">{fact.value}</dd>
                </div>
              ))}
            </dl>
            {course.syllabusUrl ? (
              <a href={course.syllabusUrl} target="_blank" rel="noopener noreferrer" className="bg-white border border-[#e3e6f0] hover:bg-[#f8f9fc] text-[#5a5c69] font-bold py-2 px-4 rounded transition-colors text-sm w-full text-center block">
                View syllabus
              </a>
            ) : (
              <p className="rounded bg-[#f8f9fc] border border-[#e3e6f0] px-3 py-2 text-sm font-bold text-[#858796]">
                Syllabus details will be provided inside the course.
              </p>
            )}
          </div>
        </DashboardCard>
      </div>

      {related.length > 0 ? (
        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#5a5c69]">Related courses</h2>
              <p className="mt-1 text-sm text-[#858796]">Explore other courses from the same category.</p>
            </div>
            <Link href={`/courses?category=${course.category}`} className="bg-white border border-[#e3e6f0] hover:bg-[#f8f9fc] text-[#5a5c69] font-bold py-2 px-4 rounded transition-colors text-sm">
              View category
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {related.map((rc) => (
              <CourseCard key={rc.id} course={rc} />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          title="No related courses available"
          description="This course is uniquely scoped in the catalog right now. Explore the catalog to find similar content."
          actions={(
            <Link href="/courses" className="btn-secondary">
              Explore courses
            </Link>
          )}
          className="mt-6"
        />
      )}
    </PageShell>
  );
}
