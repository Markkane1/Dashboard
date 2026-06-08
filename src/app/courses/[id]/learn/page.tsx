import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { fetchCourseLessons } from "@/infrastructure/api/lessons";
import CoursePlayer from "@/features/lessons/components/CoursePlayer";
import { findUserByEmail } from "@/features/users/data/userDb";
import { Link } from "@/shared/navigation";
import { logger } from '@/shared/logger';
import { PageShell } from "@/shared/components/ui/DesignSystem";

interface LearnPageProps {
  params: {
    id: string; // The courseId
  };
  searchParams: {
    lesson?: string; // Optional active lessonId
  };
}

export default async function LearnPage({ params, searchParams }: LearnPageProps) {
  // 1. Authenticate user securely on the server
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    redirect("/auth/login");
  }

  const courseId = params.id;
  const dbUser = await findUserByEmail(session.user.email);
  if (!dbUser || !dbUser.enrolledCourses?.includes(courseId)) {
    redirect(`/courses/${courseId}?error=not-enrolled`);
  }

  const token = session.apiAccessToken;
  if (!token) {
    redirect("/auth/login");
  }

  // 3. Fetch all lessons belonging to this course
  let lessons = [];
  try {
    lessons = await fetchCourseLessons(courseId, token);
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
  let activeLesson = searchParams.lesson
    ? lessons.find((l) => l._id === searchParams.lesson)
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
        initialLesson={activeLesson}
      />
    </PageShell>
  );
}
