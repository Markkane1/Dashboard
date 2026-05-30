"use client";

import React from "react";
import { Lesson } from "@/shared/types";

interface LessonSidebarProps {
  lessons: Lesson[];
  activeLesson: Lesson;
  onSelect: (lesson: Lesson) => void;
}

export default function LessonSidebar({ lessons, activeLesson, onSelect }: LessonSidebarProps) {
  // 1. Calculate progress percentages
  const completedCount = lessons.filter((l) => l.progress.completed).length;
  const totalCount = lessons.length;
  const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 2. Format duration from seconds to MM:SS
  const formatDuration = (totalSeconds: number) => {
    if (!totalSeconds || isNaN(totalSeconds)) return "0:00";
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full select-none divide-y divide-slate-100">
      
      {/* Dynamic Course Progress Bar Section */}
      <div className="p-5 bg-slate-50/50">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          <span>Your Progress</span>
          <span className="text-slate-800">{completedCount} of {totalCount} lessons ({percentComplete}%)</span>
        </div>
        
        {/* Full-width progress track */}
        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden shadow-inner">
          <div
            style={{ width: `${percentComplete}%` }}
            className="h-full bg-forest rounded-full transition-all duration-300 shadow-sm"
          />
        </div>
      </div>

      {/* Ordered Lesson List */}
      <nav className="flex-1 overflow-y-auto max-h-[calc(100vh-14rem)] divide-y divide-slate-100">
        {lessons.map((lesson) => {
          const isActive = lesson._id === activeLesson._id;
          const isCompleted = lesson.progress.completed;
          const isStarted = lesson.progress.watchedSeconds > 0;

          // Determine status symbol & text colors
          let statusSymbol = "○";
          let symbolColor = "text-slate-400";
          
          if (isCompleted) {
            statusSymbol = "✓";
            symbolColor = "text-emerald-600 bg-emerald-50 border-emerald-200";
          } else if (isStarted) {
            statusSymbol = "◑";
            symbolColor = "text-amber-600 bg-amber-50 border-amber-200";
          }

          return (
            <button
              key={lesson._id}
              onClick={() => onSelect(lesson)}
              className={`w-full text-left px-5 py-4 flex items-start gap-3.5 transition-all duration-150 border-l-4 focus:outline-none focus-visible:bg-slate-50 ${
                isActive
                  ? "bg-emerald-50/60 border-forest text-slate-900"
                  : "bg-white border-transparent text-slate-700 hover:bg-slate-50/80"
              }`}
            >
              {/* Status Circle Indicator */}
              <span className={`flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full text-xs font-black border ${symbolColor} transition-all duration-150`}>
                {statusSymbol}
              </span>

              {/* Title & Duration Details */}
              <div className="flex-1 space-y-1">
                <p className={`text-xs font-bold uppercase tracking-wide ${isActive ? "text-forest" : "text-slate-400"}`}>
                  Lesson {lesson.order + 1}
                </p>
                <h4 className={`text-sm font-black leading-snug ${isActive ? "text-slate-900" : "text-slate-800"}`}>
                  {lesson.title}
                </h4>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                  <span>⏱️</span>
                  <span>{formatDuration(lesson.duration)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
