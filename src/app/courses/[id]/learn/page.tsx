import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/../auth";
import { fetchCourseLessons } from "@/infrastructure/api/lessons";
import CoursePlayer from "@/features/lessons/components/CoursePlayer";
import { findUserByEmail } from "@/features/users/data/userDb";
import jwt from "jsonwebtoken";

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
  const userId = session.user.id;

  const dbUser = await findUserByEmail(session.user.email);
  if (!dbUser || !dbUser.enrolledCourses?.includes(courseId)) {
    redirect(`/courses/${courseId}?error=not-enrolled`);
  }

  // 2. Generate a valid JWT token on the server using NextAuth configurations
  // This matches our Express auth middleware verification keys
  const token = jwt.sign(
    { id: userId, email: session.user.email },
    process.env.AUTH_SECRET || "elearning-epa-dev-auth-secret-change-me",
    { expiresIn: "1h" }
  );
  cookies().set("auth_token", token, { httpOnly: true, sameSite: "strict", maxAge: 3600 });

  // 3. Fetch all lessons belonging to this course
  let lessons = [];
  try {
    lessons = await fetchCourseLessons(courseId, token);
  } catch (error) {
    console.error("Failed to load course lessons for player UI:", error);
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
    <div className="bg-gray-50 min-h-screen">
      <CoursePlayer
        courseId={courseId}
        lessons={lessons}
        initialLesson={activeLesson}
      />
    </div>
  );
}
