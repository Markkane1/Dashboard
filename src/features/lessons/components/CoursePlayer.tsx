"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/shared/navigation";
import { Lesson } from "@/shared/types";
import VideoPlayer from "./VideoPlayer";
import LessonSidebar from "./LessonSidebar";

interface CoursePlayerProps {
  courseId: string;
  lessons: Lesson[];
  initialLesson: Lesson;
}

export default function CoursePlayer({ courseId, lessons, initialLesson }: CoursePlayerProps) {
  const router = useRouter();
  const [activeLesson, setActiveLesson] = useState<Lesson>(initialLesson);
  const [lessonList, setLessonList] = useState(lessons);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const allLessonsCompleted = lessonList.length > 0 && lessonList.every((lesson) => lesson.progress.completed);

  // Sync lesson switch state with URL search param without triggers scroll resets
  const handleSelectLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setIsMobileSidebarOpen(false);
    router.replace(
      `/courses/${encodeURIComponent(courseId)}/learn?lesson=${encodeURIComponent(lesson._id)}`,
      { scroll: false }
    );
  };

  // Called when active lesson video reaches natural playback completion
  const handleLessonComplete = () => {
    // 1. Mark current lesson locally as completed for fluid visual feedback
    const updatedLessons = lessonList.map(l => {
      if (l._id === activeLesson._id) {
        return {
          ...l,
          progress: { watchedSeconds: l.duration, completed: true }
        };
      }
      return l;
    });
    setLessonList(updatedLessons);

    // 2. Automatically navigate to the next incomplete or adjacent lesson in order
    const currentIndex = updatedLessons.findIndex((l) => l._id === activeLesson._id);
    const nextLesson = updatedLessons[currentIndex + 1] || updatedLessons[0];

    if (nextLesson && nextLesson._id !== activeLesson._id) {
      handleSelectLesson(nextLesson);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1600px] min-w-0 flex-col overflow-hidden border-x border-slate-200 bg-white md:flex-row">
      
      {/* Sidebar: Fixed 300px Left on Desktop, Accordion/Toggle Column below on Mobile */}
      <aside className="w-full min-w-0 border-b border-slate-200 bg-white md:w-[320px] md:flex-shrink-0 md:border-b-0 md:border-r">
        
        {/* Mobile Accordion Toggle Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 md:hidden">
          <span className="min-w-0 text-sm font-black text-slate-800">Course Index</span>
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            aria-expanded={isMobileSidebarOpen}
            aria-controls="lesson-sidebar"
            aria-label={isMobileSidebarOpen ? "Hide course sidebar" : "Show course sidebar"}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forest"
          >
            <span>{isMobileSidebarOpen ? "Hide syllabus" : "Show syllabus"}</span>
            <span className="text-[10px]">{isMobileSidebarOpen ? "Up" : "Down"}</span>
          </button>
        </div>

        {/* Desktop View Sidebar or Expanded Mobile Accordion List */}
        <div id="lesson-sidebar" className={`${isMobileSidebarOpen ? "block" : "hidden"} md:block`}>
          <LessonSidebar
            lessons={lessonList}
            activeLesson={activeLesson}
            onSelect={handleSelectLesson}
          />
        </div>
      </aside>

      {/* Main viewport: Video player + description resources layout */}
      <main className="w-full min-w-0 flex-1 overflow-y-auto bg-slate-50/50 p-3 sm:p-6 lg:p-8">
        {allLessonsCompleted && (
          <div className="mx-auto mb-6 flex max-w-4xl min-w-0 flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <p className="text-sm font-black text-emerald-950">All lessons completed</p>
              <p className="mt-1 text-sm font-semibold text-emerald-800">
                Take the final quiz to complete this course.
              </p>
            </div>
            <Link
              href={`/courses/${encodeURIComponent(courseId)}/quiz`}
              className="btn-primary"
            >
              Take final quiz
            </Link>
          </div>
        )}

        <VideoPlayer
          lesson={activeLesson}
          onComplete={handleLessonComplete}
        />
      </main>
    </div>
  );
}
