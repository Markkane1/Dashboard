"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Course } from "@/shared/types";
import { CoursePageParams, fetchCoursePage } from "@/infrastructure/api/courses";
import CourseCard from "./CourseCard";

type CourseInfiniteGridProps = {
  initialCourses: Course[];
  initialNextCursor?: string;
  totalCount: number;
  filters: CoursePageParams;
};

export default function CourseInfiniteGrid({
  initialCourses,
  initialNextCursor,
  totalCount,
  filters,
}: CourseInfiniteGridProps) {
  const [courses, setCourses] = useState(initialCourses);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCourses(initialCourses);
    setNextCursor(initialNextCursor);
    setError(null);
  }, [initialCourses, initialNextCursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor || isPending) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !nextCursor || isPending) return;

        startTransition(async () => {
          try {
            const page = await fetchCoursePage({ ...filters, cursor: nextCursor });
            setCourses((current) => [...current, ...page.courses]);
            setNextCursor(page.nextCursor);
            setError(null);
          } catch {
            setError("Unable to load more courses right now.");
          }
        });
      },
      { rootMargin: "480px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filters, isPending, nextCursor]);

  if (courses.length === 0) {
    return (
      <div className="mt-16 rounded-xl border border-slate-200 bg-slate-50 py-12 text-center">
        <span className="text-4xl">ðŸƒ</span>
        <h3 className="mt-3 text-lg font-bold text-slate-800">No courses match your filters</h3>
        <p className="mt-1 text-sm text-slate-500">Try adjusting your search or catalog filters.</p>
      </div>
    );
  }

  return (
    <>
      <p className="mt-5 text-sm font-semibold text-slate-600">
        Showing {courses.length} of {totalCount} course(s)
      </p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-12" />
      {isPending && (
        <p className="mt-4 text-center text-sm font-semibold text-slate-500">Loading more courses...</p>
      )}
      {error && (
        <p className="mt-4 text-center text-sm font-semibold text-red-600">{error}</p>
      )}
    </>
  );
}
