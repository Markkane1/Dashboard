"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Course } from "@/shared/types";
import type { CourseAnalytics } from "@/infrastructure/api/admin";

interface InstructorAnalyticsPanelProps {
  courses: Course[];
}

export default function InstructorAnalyticsPanel({ courses }: InstructorAnalyticsPanelProps) {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || "");
  const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedCourseId) {
      setAnalytics(null);
      return;
    }

    startTransition(async () => {
      setError("");
      try {
        const response = await fetch(`/api/analytics/courses/${selectedCourseId}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `Failed to fetch analytics (${response.status})`);
        }

        const data: CourseAnalytics = await response.json();
        setAnalytics(data);
      } catch (err) {
        setAnalytics(null);
        setError(err instanceof Error ? err.message : "Unable to load analytics.");
      }
    });
  }, [selectedCourseId]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">Instructor analytics</h2>
        <p className="mt-2 text-sm text-slate-600">
          Monitor enrollments, completion rates, learners who remain active, and quiz performance for your course.
        </p>
        <div className="mt-5 max-w-md">
          <label className="block text-sm font-bold text-slate-700">Select course</label>
          <select
            value={selectedCourseId}
            onChange={(event) => setSelectedCourseId(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-forest focus:outline-none focus:ring-1 focus:ring-forest"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {isPending && !analytics && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">Loading analytics…</div>
      )}

      {analytics && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            ["Enrollments", analytics.enrollments],
            ["Completions", analytics.completions],
            ["Completion rate", `${analytics.completionRate}%`],
            ["Drop-off rate", `${analytics.dropOffRate}%`],
            ["Active learners", analytics.activeLearners],
            ["Weekly active", analytics.weeklyActiveLearners],
            ["Quiz attempts", analytics.quizAttempts],
            ["Avg. quiz score", `${analytics.averageQuizScore}%`],
            ["Quiz pass rate", `${analytics.quizPassRate}%`],
            ["Avg. lesson completion", `${analytics.averageLessonCompletionRate}%`],
            ["Avg. lesson watch rate", `${analytics.averageLessonWatchRate}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
