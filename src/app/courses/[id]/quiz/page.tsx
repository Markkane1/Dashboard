import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { findUserByEmail, checkCourseAccess } from "@/features/users/data/userDb";
import { fetchCourseById } from "@/infrastructure/api/courses";
import { fetchCourseQuizFromUiApi, QuizApiError } from "@/infrastructure/api/quizzes";
import QuizForm from "@/features/lessons/components/QuizForm";
import { Link } from "@/shared/navigation";

interface QuizPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function QuizPage({ params }: QuizPageProps) {
  const resolvedParams = await params;
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/login");
  }

  const courseId = resolvedParams.id;
  const dbUser = await findUserByEmail(session.user.email);
  if (!dbUser || !checkCourseAccess(dbUser, courseId)) {
    redirect(`/courses/${courseId}?error=not-enrolled`);
  }

  if (!session.apiAccessToken) {
    redirect("/auth/login");
  }

  let courseTitle = "Final Quiz";
  try {
    const course = await fetchCourseById(courseId);
    courseTitle = course.title;
  } catch {}

  try {
    const quiz = await fetchCourseQuizFromUiApi(courseId);

    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href={`/courses/${courseId}/learn`} className="text-sm font-bold text-[#1cc88a] hover:text-[#17a673]">
            &larr; Back to lessons
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-[#5a5c69] sm:text-4xl">
            Final Quiz
          </h1>
          <p className="mt-2 text-sm text-[#858796]">
            {quiz.courseTitle} &middot; Passing score: {quiz.passingScore}%
          </p>
        </div>

        <QuizForm quiz={quiz} />
      </main>
    );
  } catch (error) {
    const message = error instanceof QuizApiError
      ? error.message
      : "The final quiz could not be loaded.";

    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded border border-[#f6c23e] bg-[#fdf5dd] p-6 text-[#5a5c69]">
          <h1 className="text-2xl font-bold">{courseTitle}</h1>
          <p className="mt-3 text-sm font-bold">{message}</p>
          <Link
            href={`/courses/${courseId}/learn`}
            className="mt-5 inline-block bg-[#1cc88a] hover:bg-[#17a673] text-white font-bold py-2 px-4 rounded transition-colors text-sm"
          >
            Continue lessons
          </Link>
        </div>
      </main>
    );
  }
}
