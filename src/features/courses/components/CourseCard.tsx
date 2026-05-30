import Link from "next/link";
import { Course } from "@/shared/types";
import { categories } from "../data/categories";

function categoryLabel(category: Course["category"]) {
  return categories.find((item) => item.id === category)?.label || category;
}

export default function CourseCard({ course, children }: { course: Course; children?: React.ReactNode }) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-forest">
          {categoryLabel(course.category)}
        </span>
        {course.isDiploma && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Diploma</span>
        )}
      </div>

      <h3 className="mt-4 text-lg font-black leading-snug text-slate-950">{course.title}</h3>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {course.description || `Study ${course.mea.join(", ")} through a self-paced InforMEA course.`}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {course.sdgGoals.map((goal) => (
          <span key={goal} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            SDG {goal}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm font-bold w-full">
        <Link
          href={`/courses/${course.id}`}
          className="flex-1 text-center rounded-md bg-forest px-3 py-2 text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 transition-colors"
        >
          Take Course
        </Link>
        {course.syllabusUrl && (
          <a
            href={course.syllabusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:border-forest hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 transition-colors"
          >
            View Syllabus
          </a>
        )}
      </div>
      {children}
    </article>
  );
}
