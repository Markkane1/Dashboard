"use client";

import { useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { Course, Lesson } from "@/shared/types";
import { DashboardCard, StatusBanner } from "@/shared/components/ui/DesignSystem";

export default function VideoUploadForm({ courses }: { courses: Course[] }) {
  const { data: session } = useSession();
  const firstCourseId = courses[0]?.id || "";
  const [courseId, setCourseId] = useState(firstCourseId);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!courseId || !session?.apiAccessToken) {
      setLessons([]);
      setLessonId("");
      return;
    }

    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/lessons/manage/course/${encodeURIComponent(courseId)}`, {
          headers: {
            Authorization: `Bearer ${session.apiAccessToken}`,
          },
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `Failed to load lessons (${response.status})`);
        }

        const courseLessons: Lesson[] = await response.json();
        setLessons(courseLessons);
        setLessonId(courseLessons[0]?._id || "");
      } catch (loadError) {
        setLessons([]);
        setLessonId("");
        setError(loadError instanceof Error ? loadError.message : "Unable to load lessons.");
      }
    });
  }, [courseId, session?.apiAccessToken]);

  const handleUpload = async () => {
    if (!lessonId || !file || isUploading) return;

    setIsUploading(true);
    setMessage("");
    setError("");

    try {
      if (!session?.apiAccessToken) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const body = new FormData();
      body.append("video", file);

      const res = await fetch(`/api/admin/lessons/${encodeURIComponent(lessonId)}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.apiAccessToken}`,
        },
        body,
      });

      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(responseBody.error || "Video upload failed.");
      }

      setMessage("Video uploaded and lesson updated.");
      setFile(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Video upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardCard className="p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-bold text-slate-700">
          Course
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="control mt-2 w-full">
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-bold text-slate-700">
          Lesson
          <select
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
            disabled={isPending || lessons.length === 0}
            className="control mt-2 w-full"
          >
            {isPending ? (
              <option value="">Loading lessons...</option>
            ) : lessons.length === 0 ? (
              <option value="">No lessons found</option>
            ) : lessons.map((lesson) => (
              <option key={lesson._id} value={lesson._id}>
                {lesson.order}. {lesson.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        MP4 video file
        <input
          type="file"
          accept="video/mp4"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          className="control mt-2 block w-full"
        />
      </label>

      {message && <StatusBanner variant="success" title={message} className="mt-4" />}
      {error && <StatusBanner variant="error" title={error} className="mt-4" />}

      <button
        type="button"
        disabled={!lessonId || !file || isUploading || isPending}
        onClick={handleUpload}
        className="btn-primary mt-4"
      >
        {isUploading ? "Uploading..." : "Upload video"}
      </button>
    </DashboardCard>
  );
}
