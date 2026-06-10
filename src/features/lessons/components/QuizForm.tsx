"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CourseQuiz } from "@/shared/types";

type QuizResult = {
  score: number;
  passingScore: number;
  totalQuestions: number;
  correctCount: number;
  passed: boolean;
};

export default function QuizForm({ quiz }: { quiz: CourseQuiz }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState("");

  const allAnswered = quiz.questions.every((question) => answers[question.id] !== undefined);

  const handleSubmit = async () => {
    if (!allAnswered || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      if (!session?.apiAccessToken) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const res = await fetch("/api/courses/quiz-submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: quiz.courseId,
          answers: Object.entries(answers).map(([questionId, selectedOptionIndex]) => ({
            questionId,
            selectedOptionIndex
          }))
        })
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Failed to submit quiz.");
      }

      setResult(body);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit quiz.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {quiz.latestSubmission?.passed && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">
          You already passed this quiz with a score of {quiz.latestSubmission.score}%.
        </div>
      )}

      {quiz.questions.map((question, questionIndex) => (
        <section key={question.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-slate-950">
            {questionIndex + 1}. {question.prompt}
          </h2>
          <div className="mt-4 space-y-3">
            {question.options.map((option, optionIndex) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm font-semibold text-slate-700 transition hover:border-forest hover:bg-emerald-50/40"
              >
                <input
                  type="radio"
                  name={question.id}
                  value={optionIndex}
                  checked={answers[question.id] === optionIndex}
                  onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                  className="mt-1"
                  disabled={!!result}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </section>
      ))}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div className={`rounded-lg border px-5 py-4 text-sm font-bold ${
          result.passed
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}>
          Score: {result.score}% ({result.correctCount}/{result.totalQuestions} correct).
          {result.passed ? " You passed. The course is now complete." : ` You need ${result.passingScore}% to pass.`}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!result && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered || isSubmitting}
            className="rounded-lg bg-forest px-6 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Submitting..." : "Submit quiz"}
          </button>
        )}

        {result?.passed && (
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-ocean px-6 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#0b5366]"
          >
            Return to dashboard
          </button>
        )}
      </div>
    </div>
  );
}
