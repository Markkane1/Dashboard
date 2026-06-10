import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { findUserByEmail } from "@/features/users/data/userDb";
import { fetchCourseById } from "@/infrastructure/api/courses";
import { fetchCourseQuizFromUiApi, QuizApiError } from "@/infrastructure/api/quizzes";
import QuizForm from "@/features/lessons/components/QuizForm";
import { Link } from "@/shared/navigation";

interface QuizPageProps {
  params: {
    id: string;
  };
}

export default async function QuizPage({ params }: QuizPageProps) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/login");
  }

  const courseId = params.id;
  const dbUser = await findUserByEmail(session.user.email);
  if (!dbUser || !dbUser.enrolledCourses?.includes(courseId)) {
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
          <Link href={`/courses/${courseId}/learn`} className="text-sm font-black text-forest hover:text-emerald-800">
            &larr; Back to lessons
          </Link>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Final Quiz
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">
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
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <h1 className="text-2xl font-black">{courseTitle}</h1>
          <p className="mt-3 text-sm font-bold">{message}</p>
          <Link
            href={`/courses/${courseId}/learn`}
            className="mt-5 inline-flex rounded-lg bg-forest px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-800"
          >
            Continue lessons
          </Link>
        </div>
      </main>
    );
  }
}
