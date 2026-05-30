import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { fetchCourses } from "@/infrastructure/api/courses";
import { fetchManageableLessons } from "@/infrastructure/api/instructorLessons";
import VideoUploadForm from "@/features/lessons/components/VideoUploadForm";

export default async function InstructorVideosPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/login");
  }

  const role = (session.user as any).role || "student";
  if (!["admin", "instructor"].includes(role)) {
    redirect("/dashboard");
  }

  const token = session.apiAccessToken;
  if (!token) {
    redirect("/auth/login");
  }

  const courses = (await fetchCourses()).filter((course) => !course.isExternal && !course.isDiploma);
  const lessonsByCourse: Record<string, Awaited<ReturnType<typeof fetchManageableLessons>>> = {};

  await Promise.all(
    courses.map(async (course) => {
      try {
        lessonsByCourse[course.id] = await fetchManageableLessons(course.id, token);
      } catch {
        lessonsByCourse[course.id] = [];
      }
    })
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-wider text-forest">Instructor tools</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Video uploads</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-slate-600">
          Upload MP4 lesson videos into local storage. The backend saves files in `uploads/videos`,
          updates the lesson `videoUrl`, and reads duration with ffprobe when available.
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-600">
          No internal courses are available for uploads yet.
        </div>
      ) : (
        <VideoUploadForm courses={courses} lessonsByCourse={lessonsByCourse} />
      )}
    </main>
  );
}
