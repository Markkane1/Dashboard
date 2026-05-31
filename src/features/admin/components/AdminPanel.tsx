"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AuthoredQuizQuestion, Course, User } from "@/shared/types";
import { AnalyticsOverview } from "@/infrastructure/api/admin";
import { ASSIGNABLE_USER_ROLES } from "@/shared/permissions";
import QuizAuthoringEditor from "./QuizAuthoringEditor";

type AdminPanelProps = {
  token: string;
  courses: Course[];
  users: User[];
  analytics: AnalyticsOverview;
};

async function apiRequest(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function cleanQuizQuestions(questions: AuthoredQuizQuestion[]) {
  return questions
    .map((question, index) => ({
      id: question.id || `question-${index + 1}`,
      prompt: question.prompt.trim(),
      options: question.options.map((option) => option.trim()).filter(Boolean),
      correctAnswerIndex: question.correctAnswerIndex,
      explanation: question.explanation?.trim() || "",
    }))
    .filter((question) => question.prompt || question.options.length > 0);
}

export default function AdminPanel({ token, courses, users, analytics }: AdminPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || "");
  const [quizQuestions, setQuizQuestions] = useState<AuthoredQuizQuestion[]>([]);

  const run = (action: () => Promise<void>) => {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  };

  const createCourse = (formData: FormData) => run(async () => {
    await apiRequest("/courses", token, {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        description: formData.get("description"),
        category: formData.get("category"),
        thumbnail: formData.get("thumbnail"),
        instructorName: formData.get("instructorName"),
        duration: formData.get("duration"),
        price: Number(formData.get("price") || 0),
        quizPassingScore: Number(formData.get("quizPassingScore") || 70),
        quizQuestions: cleanQuizQuestions(quizQuestions),
      }),
    });
    setQuizQuestions([]);
    setMessage("Course created.");
  });

  const createLesson = (formData: FormData) => run(async () => {
    await apiRequest("/lessons", token, {
      method: "POST",
      body: JSON.stringify({
        courseId: formData.get("courseId"),
        title: formData.get("title"),
        description: formData.get("description"),
        order: Number(formData.get("order") || 0),
        videoUrl: formData.get("videoUrl"),
        duration: Number(formData.get("duration") || 0),
        transcript: formData.get("transcript"),
        isPublished: formData.get("isPublished") === "on",
      }),
    });
    setMessage("Lesson created.");
  });

  const updateRole = (userId: string, role: string) => run(async () => {
    await apiRequest(`/users/${userId}/role`, token, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    setMessage("User role updated.");
  });

  const announce = (formData: FormData) => run(async () => {
    await apiRequest("/notifications/announce", token, {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        message: formData.get("message"),
        linkUrl: formData.get("linkUrl"),
      }),
    });
    setMessage("Announcement sent.");
  });

  return (
    <div className="space-y-8">
      {(message || error) && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-forest"}`}>
          {error || message}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Users", analytics.users],
          ["Courses", analytics.courses],
          ["Enrollments", analytics.enrollments],
          ["Completion", `${analytics.completionRate}%`],
          ["Daily active", analytics.dailyActiveUsers],
          ["Weekly active", analytics.weeklyActiveUsers],
          ["Avg. lesson completion", `${analytics.averageLessonCompletionRate}%`],
          ["Avg. watch rate", `${analytics.averageLessonWatchRate}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createCourse(new FormData(event.currentTarget));
          }}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-black text-slate-950">Create course</h2>
          <input name="title" required placeholder="Title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="description" required placeholder="Description" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="category" required placeholder="Category slug" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="instructorName" placeholder="Instructor name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="duration" placeholder="Duration label" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="price" type="number" min="0" defaultValue="0" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="quizPassingScore" type="number" min="0" max="100" defaultValue="70" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="thumbnail" placeholder="Thumbnail URL" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <QuizAuthoringEditor questions={quizQuestions} onChange={setQuizQuestions} disabled={isPending} />
          <button disabled={isPending} className="rounded-md bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            Create course
          </button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            createLesson(new FormData(event.currentTarget));
          }}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-black text-slate-950">Create lesson</h2>
          <select name="courseId" required value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <input name="title" required placeholder="Lesson title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="description" placeholder="Lesson description" rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="order" required type="number" min="0" defaultValue="1" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="duration" type="number" min="0" defaultValue="0" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <input name="videoUrl" required placeholder="/uploads/videos/example.mp4" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="transcript" placeholder="Transcript" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input name="isPublished" type="checkbox" /> Published
          </label>
          <button disabled={isPending || courses.length === 0} className="rounded-md bg-ocean px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            Create lesson
          </button>
        </form>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">User administration</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <select defaultValue={user.role || "student"} onChange={(event) => updateRole(user.id, event.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                  {ASSIGNABLE_USER_ROLES.map((role) => (
                    <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Learning analytics</h2>
          <div className="mt-4 space-y-3">
            {analytics.topCourses.map((course) => (
              <div key={course.courseId} className="rounded-md bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">{course.title}</p>
                  <p className="text-xs font-bold text-forest">{course.completionRate}% complete</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">{course.enrollments} enrollments, {course.completions} completions</p>
              </div>
            ))}
            {analytics.topCourses.length === 0 && <p className="text-sm text-slate-500">No enrollment data yet.</p>}
          </div>
        </section>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          announce(new FormData(event.currentTarget));
        }}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-black text-slate-950">Send announcement</h2>
        <input name="title" required placeholder="Title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <textarea name="message" required placeholder="Message" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="linkUrl" placeholder="/courses" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={isPending} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60">
          Send to all users
        </button>
      </form>
    </div>
  );
}
