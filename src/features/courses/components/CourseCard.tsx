import Link from "next/link";
import { Course } from "@/shared/types";
import { categories } from "../data/categories";

function categoryLabel(category: Course["category"]) {
  return categories.find((item) => item.id === category)?.label || category;
}

export default function CourseCard({ course, children }: { course: Course; children?: React.ReactNode }) {
  return (
    <article className="flex h-full min-w-0 flex-col glass-card p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 border-white/20 bg-white/50 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="rounded-full bg-[#b0f0d6]/40 px-3.5 py-1 text-xs font-bold text-[#003527] border border-[#95d3ba]/30">
          {categoryLabel(course.category)}
        </span>
        {course.isDiploma && (
          <span className="rounded-full bg-amber-100/60 px-3.5 py-1 text-xs font-bold text-amber-800 border border-amber-200/30">Diploma</span>
        )}
      </div>

      <h3 className="mt-4 text-lg font-black leading-snug tracking-tight text-slate-950 font-sora">{course.title}</h3>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {course.description || `Study ${(course.mea || course.sections || []).join(", ")} through a self-paced environmental course.`}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {course.sdgGoals.map((goal) => (
          <span key={goal} className="rounded-md bg-white/60 border border-slate-200/40 px-2.5 py-1 text-xs font-semibold text-slate-650">
            SDG {goal}
          </span>
        ))}
      </div>

      <div className="mt-auto flex w-full flex-col gap-2 pt-5 text-sm font-bold sm:flex-row">
        <Link
          href={`/courses/${course.id}`}
          className="flex-1 rounded-full bg-forest px-4 py-2.5 text-center text-white transition-all hover:bg-[#b0f0d6] hover:text-[#003527] focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 shadow-sm"
        >
          Take Course
        </Link>
        {course.syllabusUrl && (
          <a
            href={course.syllabusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-full border border-slate-300 bg-white/40 px-4 py-2.5 text-center text-slate-700 transition-all hover:border-forest hover:bg-white/80 hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
          >
            Syllabus
          </a>
        )}
      </div>
      {children}
    </article>
  );
}
