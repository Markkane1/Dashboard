import { notFound } from "next/navigation";
import { Link } from "@/shared/navigation";
import CourseCard from "@/features/courses/components/CourseCard";
import EnrollButton from "@/features/enrollments/components/EnrollButton";
import { categories } from "@/features/courses/data/categories";
import { fetchCourseById, fetchCourses } from "@/infrastructure/api/courses";
import { auth } from "@/../auth";
import { findUserByEmail } from "@/features/users/data/userDb";
import { Metadata } from "next";
import { Course } from "@/shared/types";

export async function generateStaticParams() {
  try {
    const courses = await fetchCourses();
    return courses.map((course) => ({ id: course.id }));
  } catch (error) {
    return [];
  }
}

interface CourseDetailPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: CourseDetailPageProps): Promise<Metadata> {
  let course;
  try {
    course = await fetchCourseById(params.id);
  } catch (error) {
    return {
      title: "Course Not Found | InforMEA Learning",
    };
  }
  return {
    title: `${course.title} | InforMEA Learning`,
    description: course.description || "United Nations Information Portal on Multilateral Environmental Agreements",
    openGraph: {
      title: `${course.title} | InforMEA Learning`,
      description: course.description || "United Nations Information Portal on Multilateral Environmental Agreements",
      type: "article",
      siteName: "InforMEA Learning",
    },
    twitter: {
      card: "summary_large_image",
      title: `${course.title} | InforMEA Learning`,
      description: course.description || "United Nations Information Portal on Multilateral Environmental Agreements",
    },
  };
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  let course;
  try {
    course = await fetchCourseById(params.id);
  } catch (error) {
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

  // Related courses (up to 4, same category, excluding current)
  let related: Course[] = [];
  try {
    const allCourses = await fetchCourses();
    related = allCourses
      .filter((c) => c.category === course.category && c.id !== course.id)
      .slice(0, 4);
  } catch (error) {}

  const sdgColors: Record<number, string> = {
    1: "#E5243B",
    2: "#DDA63A",
    3: "#4C9F38",
    4: "#C5192D",
    5: "#FF3A21",
    6: "#26BDE2",
    7: "#FCC30B",
    8: "#A21942",
    9: "#FD6925",
    10: "#DD1367",
    11: "#FD9D24",
    12: "#BF8B2E",
    13: "#3F7E44",
    14: "#0A97D9",
    15: "#56C02B",
    16: "#00689D",
    17: "#19486A",
  };

  return (
    <article className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* 1. Breadcrumb */}
      <nav className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-8">
        <Link href="/" className="hover:text-forest transition-colors">
          Home
        </Link>
        <span>&gt;</span>
        {categoryObj ? (
          <Link href={`/?category=${categoryObj.id}`} className="hover:text-forest transition-colors">
            {categoryLabel}
          </Link>
        ) : (
          <span>{categoryLabel}</span>
        )}
        <span>&gt;</span>
        <span className="text-slate-800 line-clamp-1 max-w-md">{course.title}</span>
      </nav>

      {/* Course Detail Card */}
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 lg:p-10">
        
        {/* Category badge, SDG goals, MEA tags */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-black text-forest border border-emerald-100">
            {categoryLabel}
          </span>
          
          {course.isDiploma && (
            <span className="rounded-full bg-amber-100 px-3.5 py-1 text-xs font-black text-amber-800 border border-amber-200 shadow-sm animate-pulse">
              Diploma
            </span>
          )}

          {course.sdgGoals.map((goal) => (
            <span
              key={goal}
              style={{ backgroundColor: sdgColors[goal] || "#475569" }}
              className="rounded-md px-2 py-0.5 text-[10px] font-black text-white shadow-sm"
              title={`SDG Target Goal ${goal}`}
            >
              SDG {goal}
            </span>
          ))}

          {course.mea.map((m) => (
            <span
              key={m}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200"
            >
              {m}
            </span>
          ))}
        </div>

        {/* 2. Course Title */}
        <h1 className="mt-6 text-3xl font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
          {course.title}
        </h1>

        {/* 3. Course Description */}
        <div className="mt-8 prose prose-slate max-w-none text-base leading-relaxed text-slate-700">
          {course.description ? (
            <p>{course.description}</p>
          ) : (
            <p className="italic text-slate-500 bg-slate-50 rounded-xl p-5 border border-slate-200">
              This course is part of the InforMEA e-learning platform. Please enroll to view the full course content.
            </p>
          )}
        </div>

        {/* 4. Action Buttons */}
        <div className="mt-10 flex flex-wrap items-center gap-4 pt-8 border-t border-slate-100">
          
          {/* Enroll in this course */}
          <EnrollButton
            courseId={course.id}
            isAuthenticated={isAuthenticated}
            initialEnrolled={initialEnrolled}
          />

          {/* View Syllabus (PDF) */}
          {course.syllabusUrl && (
            <a
              href={course.syllabusUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              View Syllabus (PDF)
            </a>
          )}

          {/* Take Course (only for isExternal) */}
          {course.isExternal && course.externalUrl && (
            <a
              href={course.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-ocean px-6 py-3 text-sm font-black text-white hover:bg-[#0b5366] transition-colors shadow-sm"
            >
              Take Course
            </a>
          )}

        </div>

      </div>

      {/* 5. Related Courses */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-black text-slate-950 mb-6">Related Courses</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {related.map((rc) => (
              <CourseCard key={rc.id} course={rc} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
