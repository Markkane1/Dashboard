"use client";

import { useState } from "react";
import { Course, Lesson } from "@/shared/types";

export default function VideoUploadForm({ courses, lessonsByCourse }: {
  courses: Course[];
  lessonsByCourse: Record<string, Lesson[]>;
}) {
  const firstCourseId = courses[0]?.id || "";
  const [courseId, setCourseId] = useState(firstCourseId);
  const [lessonId, setLessonId] = useState(lessonsByCourse[firstCourseId]?.[0]?._id || "");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const lessons = lessonsByCourse[courseId] || [];

  const handleCourseChange = (nextCourseId: string) => {
    setCourseId(nextCourseId);
    setLessonId(lessonsByCourse[nextCourseId]?.[0]?._id || "");
    setMessage("");
    setError("");
  };

  const handleUpload = async () => {
    if (!lessonId || !file || isUploading) return;

    setIsUploading(true);
    setMessage("");
    setError("");

    try {
      const body = new FormData();
      body.append("video", file);

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${apiBase}/api/lessons/${lessonId}/upload`, {
        method: "POST",
        credentials: "include",
        body
      });

      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(responseBody.error || "Video upload failed.");
      }

      setMessage("Video uploaded and lesson metadata updated.");
      setFile(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Video upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-bold text-slate-700">
          Select course
          <select
            value={courseId}
            onChange={(event) => handleCourseChange(event.target.value)}
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-forest focus:outline-none focus:ring-1 focus:ring-forest"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-bold text-slate-700">
          Select lesson
          <select
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-forest focus:outline-none focus:ring-1 focus:ring-forest"
          >
            {lessons.length === 0 ? (
              <option value="">No lessons found</option>
            ) : lessons.map((lesson) => (
              <option key={lesson._id} value={lesson._id}>
                {lesson.order}. {lesson.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-5 block text-sm font-bold text-slate-700">
        MP4 video file
        <input
          type="file"
          accept="video/mp4"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
        />
      </label>

      {message && <p className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm font-bold text-forest">{message}</p>}
      {error && <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

      <button
        type="button"
        disabled={!lessonId || !file || isUploading}
        onClick={handleUpload}
        className="mt-5 rounded-lg bg-forest px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isUploading ? "Uploading..." : "Upload video"}
      </button>
    </div>
  );
}
