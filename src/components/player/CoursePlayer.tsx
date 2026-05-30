"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lesson } from "@/lib/types";
import VideoPlayer from "./VideoPlayer";
import LessonSidebar from "./LessonSidebar";

interface CoursePlayerProps {
  courseId: string;
  lessons: Lesson[];
  initialLesson: Lesson;
  token: string;
}

export default function CoursePlayer({ courseId, lessons, initialLesson, token }: CoursePlayerProps) {
  const router = useRouter();
  const [activeLesson, setActiveLesson] = useState<Lesson>(initialLesson);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Sync lesson switch state with URL search param without triggers scroll resets
  const handleSelectLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setIsMobileSidebarOpen(false);
    router.replace(`/courses/${courseId}/learn?lesson=${lesson._id}`, { scroll: false });
  };

  // Called when active lesson video reaches natural playback completion
  const handleLessonComplete = () => {
    // 1. Mark current lesson locally as completed for fluid visual feedback
    const updatedLessons = lessons.map(l => {
      if (l._id === activeLesson._id) {
        return {
          ...l,
          progress: { watchedSeconds: l.duration, completed: true }
        };
      }
      return l;
    });

    // 2. Automatically navigate to the next incomplete or adjacent lesson in order
    const currentIndex = lessons.findIndex((l) => l._id === activeLesson._id);
    const nextLesson = lessons[currentIndex + 1] || lessons[0];

    if (nextLesson && nextLesson._id !== activeLesson._id) {
      handleSelectLesson(nextLesson);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] bg-white min-h-[calc(100vh-4rem)] flex flex-col md:flex-row shadow-sm ring-1 ring-slate-100">
      
      {/* Sidebar: Fixed 300px Left on Desktop, Accordion/Toggle Column below on Mobile */}
      <aside className="w-full md:w-[320px] md:flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-white">
        
        {/* Mobile Accordion Toggle Header */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="text-sm font-black text-slate-800">Course Index</span>
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-black text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forest"
          >
            <span>{isMobileSidebarOpen ? "Hide syllabus" : "Show syllabus"}</span>
            <span className="text-[10px]">{isMobileSidebarOpen ? "▲" : "▼"}</span>
          </button>
        </div>

        {/* Desktop View Sidebar or Expanded Mobile Accordion List */}
        <div className={`${isMobileSidebarOpen ? "block" : "hidden"} md:block`}>
          <LessonSidebar
            lessons={lessons}
            activeLesson={activeLesson}
            onSelect={handleSelectLesson}
          />
        </div>
      </aside>

      {/* Main viewport: Video player + description resources layout */}
      <main className="flex-1 bg-slate-50/50 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <VideoPlayer
          lesson={activeLesson}
          courseId={courseId}
          onComplete={handleLessonComplete}
          token={token}
        />
      </main>
    </div>
  );
}
