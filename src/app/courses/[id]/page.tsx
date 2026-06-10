import { notFound } from "next/navigation";
import { Link } from "@/shared/navigation";
import CourseCard from "@/features/courses/components/CourseCard";
import EnrollButton from "@/features/enrollments/components/EnrollButton";
import { categories } from "@/features/courses/data/categories";
import { fetchCourseById, fetchCoursePage } from "@/infrastructure/api/courses";
import { auth } from "@/../auth";
import { findUserByEmail } from "@/features/users/data/userDb";
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
  params: {
    id: string;
  };
  searchParams?: {
    error?: string;
  };
}

export async function generateMetadata({ params }: CourseDetailPageProps): Promise<Metadata> {
  let course;
  try {
    course = await fetchCourseById(params.id);
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
  let course;
  try {
    course = await fetchCourseById(params.id);
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
    if (dbUser && dbUser.enrolledCourses) {
      initialEnrolled = dbUser.enrolledCourses.includes(params.id);
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

  let related: Course[] = [];
  try {
    const relatedPage = await fetchCoursePage({ category: course.category, limit: 5 });
    related = relatedPage.courses
      .filter((c) => c.category === course.category && c.id !== course.id)
      .slice(0, 4);
  } catch {}

  return (
    <PageShell>
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold text-text-muted">
        <Link href="/courses" className="text-sm font-semibold text-secondary hover:text-primary">
          Courses
        </Link>
        <span>{" > "}</span>
        {categoryObj ? (
          <Link href={`/courses?category=${categoryObj.id}`} className="text-sm font-semibold text-secondary hover:text-primary">
            {categoryLabel}
          </Link>
        ) : (
          <span className="text-sm font-semibold text-text-primary">{categoryLabel}</span>
        )}
        <span>{" > "}</span>
        <span className="min-w-0 max-w-full truncate text-sm text-text-primary sm:max-w-md">{course.title}</span>
      </nav>

      {searchParams?.error === "not-enrolled" && (
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
            <EnrollButton courseId={course.id} isAuthenticated={isAuthenticated} initialEnrolled={initialEnrolled} />
            {course.syllabusUrl && (
              <a href={course.syllabusUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                View syllabus
              </a>
            )}
            {course.isExternal && course.externalUrl && (
              <a href={course.externalUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
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
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-muted">{categoryLabel}</span>
              {course.isDiploma && (
                <span className="rounded-full bg-mint/20 px-3 py-1 text-xs font-semibold text-secondary">Diploma</span>
              )}
            </div>
            <div className="grid gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-text-muted">SDGs</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {course.sdgGoals.map((goal) => (
                    <span key={goal} className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-primary">SDG {goal}</span>
                  ))}
                </div>
              </div>
              {topics.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-text-muted">Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {topics.map((item) => (
                      <span key={item} className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-primary">{item.replace(/-/g, " ")}</span>
                    ))}
                  </div>
                </div>
              )}
              {sectionLabels.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-text-muted">Sections</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sectionLabels.map((item) => (
                      <span key={item} className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-primary">{item}</span>
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
              <h2 className="text-lg font-black text-text-primary">Course quick facts</h2>
              <p className="mt-1 text-sm text-text-muted">Use this summary before enrolling.</p>
            </div>
            <dl className="grid gap-3">
              {quickFacts.map((fact) => (
                <div key={fact.label} className="rounded-lg border border-border bg-surface px-3 py-2">
                  <dt className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">{fact.label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-text-primary">{fact.value}</dd>
                </div>
              ))}
            </dl>
            {course.syllabusUrl ? (
              <a href={course.syllabusUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full">
                View syllabus
              </a>
            ) : (
              <p className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold text-text-muted">
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
              <h2 className="text-xl font-black text-text-primary">Related courses</h2>
              <p className="mt-1 text-sm text-text-muted">Explore other courses from the same category.</p>
            </div>
            <Link href={`/courses?category=${course.category}`} className="btn-secondary">
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
