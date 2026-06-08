import Link from "next/link";
import { Course } from "@/shared/types";
import { categories } from "../data/categories";

function categoryLabel(category: Course["category"]) {
  return categories.find((item) => item.id === category)?.label || category;
}

export default function CourseCard({ course, children }: { course: Course; children?: React.ReactNode }) {
  const sdgPreview = course.sdgGoals.slice(0, 4);
  const remainingSdgs = course.sdgGoals.length - sdgPreview.length;

  return (
    <article className="dashboard-card flex h-full min-w-0 flex-col p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-wide text-teal-700">
            {categoryLabel(course.category)}
          </p>
          <h3 className="mt-2 line-clamp-2 text-base font-black leading-snug text-slate-950">
            {course.title}
          </h3>
        </div>
        {course.isDiploma && (
          <span className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
            Diploma
          </span>
        )}
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {course.description || `Study ${(course.mea || course.sections || []).join(", ")} through a self-paced environmental course.`}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {sdgPreview.map((goal) => (
          <span key={goal} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            SDG {goal}
          </span>
        ))}
        {remainingSdgs > 0 && (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            +{remainingSdgs}
          </span>
        )}
      </div>

      <div className="mt-auto flex w-full flex-col gap-2 pt-5 text-sm font-bold sm:flex-row">
        <Link href={`/courses/${course.id}`} className="btn-primary flex-1">
          Open course
        </Link>
        {course.syllabusUrl && (
          <a href={course.syllabusUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1">
            Syllabus
          </a>
        )}
      </div>
      {children}
    </article>
  );
}
