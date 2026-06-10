import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { fetchCourseAssignments } from "@/infrastructure/api/assignments";
import { fetchCourseLessons } from "@/infrastructure/api/lessons";
import CoursePlayer from "@/features/lessons/components/CoursePlayer";
import { Link } from "@/shared/navigation";
import { logger } from '@/shared/logger';
import { PageShell } from "@/shared/components/ui/DesignSystem";

interface LearnPageProps {
  params: Promise<{
    id: string; // The courseId
  }>;
  searchParams: Promise<{
    lesson?: string; // Optional active lessonId
  }>;
}

export default async function LearnPage({ params, searchParams }: LearnPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  // 1. Authenticate user securely on the server
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    redirect("/auth/login");
  }

  const courseId = resolvedParams.id;
  const token = session.apiAccessToken;
  if (!token) {
    redirect("/auth/login");
  }

  // Course access is enforced by the Express lesson/assignment APIs via hasCourseAccess.
  let lessons = [];
  let assignments = [];
  try {
    [lessons, assignments] = await Promise.all([
      fetchCourseLessons(courseId, token),
      fetchCourseAssignments(courseId, token),
    ]);
  } catch (error) {
    logger.error("Failed to load course lessons for player UI:", error);
    // If the error is 403 (unauthorized/not enrolled), we can redirect to course detail
    redirect(`/courses/${courseId}`);
  }

  if (lessons.length === 0) {
    // If no lessons are published yet, redirect back to course main page
    redirect(`/courses/${courseId}`);
  }

  // 4. Determine the active lesson
  // A. Use search parameter if present and valid
  let activeLesson = resolvedSearchParams.lesson
    ? lessons.find((l) => l._id === resolvedSearchParams.lesson)
    : undefined;

  // B. Fallback 1: First incomplete lesson (progress.completed is false)
  if (!activeLesson) {
    activeLesson = lessons.find((l) => !l.progress.completed);
  }

  // C. Fallback 2: First lesson in the ordered list
  if (!activeLesson) {
    activeLesson = lessons[0];
  }

  return (
    <PageShell className="px-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3 sm:px-6">
        <Link href={`/courses/${courseId}`} className="btn-secondary">
          Back to course
        </Link>
        <p className="text-sm font-semibold text-text-muted">Learning path</p>
      </div>

      <CoursePlayer
        courseId={courseId}
        lessons={lessons}
        assignments={assignments}
        initialLesson={activeLesson}
      />
    </PageShell>
  );
}
