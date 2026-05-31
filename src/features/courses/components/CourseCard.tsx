import Link from "next/link";
import { Course } from "@/shared/types";
import { categories } from "../data/categories";

function categoryLabel(category: Course["category"]) {
  return categories.find((item) => item.id === category)?.label || category;
}

export default function CourseCard({ course, children }: { course: Course; children?: React.ReactNode }) {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-forest ring-1 ring-emerald-100">
          {categoryLabel(course.category)}
        </span>
        {course.isDiploma && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">Diploma</span>
        )}
      </div>

      <h3 className="mt-4 text-lg font-black leading-snug tracking-tight text-slate-950">{course.title}</h3>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {course.description || `Study ${(course.mea || course.sections || []).join(", ")} through a self-paced environmental course.`}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {course.sdgGoals.map((goal) => (
          <span key={goal} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            SDG {goal}
          </span>
        ))}
      </div>

      <div className="mt-auto flex w-full flex-col gap-2 pt-5 text-sm font-bold sm:flex-row">
        <Link
          href={`/courses/${course.id}`}
          className="flex-1 rounded-lg bg-forest px-3 py-2.5 text-center text-white transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
        >
          Take Course
        </Link>
        {course.syllabusUrl && (
          <a
            href={course.syllabusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-center text-slate-700 transition-colors hover:border-forest hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
          >
            View Syllabus
          </a>
        )}
      </div>
      {children}
    </article>
  );
}
