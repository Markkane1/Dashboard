"use client";

import React from "react";
import { Lesson } from "@/shared/types";

interface LessonSidebarProps {
  lessons: Lesson[];
  activeLesson: Lesson;
  onSelect: (lesson: Lesson) => void;
}

function formatDuration(totalSeconds: number) {
  if (!totalSeconds || Number.isNaN(totalSeconds)) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function LessonSidebar({ lessons, activeLesson, onSelect }: LessonSidebarProps) {
  const completedCount = lessons.filter((lesson) => lesson.progress.completed).length;
  const totalCount = lessons.length;
  const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="flex h-full min-w-0 flex-col divide-y divide-slate-200">
      <div className="bg-slate-50 p-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
          <span>Progress</span>
          <span>{completedCount}/{totalCount} lessons</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div style={{ width: `${percentComplete}%` }} className="h-full rounded-full bg-teal-700" />
        </div>
      </div>

      <nav className="max-h-[60vh] flex-1 divide-y divide-slate-100 overflow-y-auto md:max-h-[calc(100vh-14rem)]">
        {lessons.map((lesson) => {
          const isActive = lesson._id === activeLesson._id;
          const isCompleted = lesson.progress.completed;
          const isStarted = lesson.progress.watchedSeconds > 0;
          const status = isCompleted ? "Done" : isStarted ? "Started" : "New";

          return (
            <button
              key={lesson._id}
              onClick={() => onSelect(lesson)}
              className={`flex w-full min-w-0 items-start gap-3 border-l-4 px-4 py-3 text-left ${
                isActive
                  ? "border-teal-700 bg-teal-50 text-slate-950"
                  : "border-transparent bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className={`mt-0.5 rounded-md px-2 py-1 text-[11px] font-black ${
                isCompleted
                  ? "bg-teal-100 text-teal-700"
                  : isStarted
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600"
              }`}>
                {status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Lesson {lesson.order + 1}</p>
                <h4 className="mt-1 text-sm font-black leading-snug text-slate-900">{lesson.title}</h4>
                <p className="mt-1 text-xs font-semibold text-slate-500">{formatDuration(lesson.duration)}</p>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
