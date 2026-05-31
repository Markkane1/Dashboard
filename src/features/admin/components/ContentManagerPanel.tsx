"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Course } from "@/shared/types";

type ContentManagerPanelProps = {
  token: string;
  courses: Course[];
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function apiRequest(path: string, token: string, init: RequestInit) {
  const res = await fetch(`${apiUrl}${path}`, {
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
}

export default function ContentManagerPanel({ token, courses }: ContentManagerPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || "");

  const run = (action: () => Promise<void>) => {
    setStatus("");
    setError("");
    startTransition(async () => {
      try {
        await action();
        setStatus("Saved.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  return (
    <div className="space-y-6">
      {(status || error) && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-forest"}`}>
          {error || status}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            run(() => apiRequest("/api/courses", token, {
              method: "POST",
              body: JSON.stringify({
                title: formData.get("title"),
                description: formData.get("description"),
                category: formData.get("category"),
                instructorName: formData.get("instructorName"),
                duration: formData.get("duration"),
                price: Number(formData.get("price") || 0),
              }),
            }));
          }}
        >
          <h2 className="text-xl font-black text-slate-950">Create course</h2>
          <input name="title" required placeholder="Title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="description" required placeholder="Description" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="category" required placeholder="Category slug" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="instructorName" placeholder="Instructor name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="duration" placeholder="Duration" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="price" type="number" min="0" defaultValue="0" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button disabled={isPending} className="rounded-md bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            Create course
          </button>
        </form>

        <form
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            run(() => apiRequest("/api/lessons", token, {
              method: "POST",
              body: JSON.stringify({
                courseId: formData.get("courseId"),
                title: formData.get("title"),
                description: formData.get("description"),
                order: Number(formData.get("order") || 0),
                videoUrl: formData.get("videoUrl"),
                isPublished: formData.get("isPublished") === "on",
              }),
            }));
          }}
        >
          <h2 className="text-xl font-black text-slate-950">Create lesson</h2>
          <select name="courseId" required value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <input name="title" required placeholder="Lesson title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="description" placeholder="Description" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="order" required type="number" min="0" defaultValue="1" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="videoUrl" required placeholder="/uploads/videos/example.mp4" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input name="isPublished" type="checkbox" /> Published
          </label>
          <button disabled={isPending || courses.length === 0} className="rounded-md bg-ocean px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            Create lesson
          </button>
        </form>
      </div>
    </div>
  );
}
