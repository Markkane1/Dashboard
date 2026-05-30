"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Lesson } from "@/shared/types";

interface VideoPlayerProps {
  lesson: Lesson;
  courseId: string;
  onComplete: () => void;
}

export default function VideoPlayer({ lesson, courseId, onComplete }: VideoPlayerProps) {
  const { data: session } = useSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentTimeRef = useRef(0);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [videoSource, setVideoSource] = useState("");
  const apiToken = session?.apiAccessToken;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    let objectUrl = "";
    const abortController = new AbortController();

    async function loadVideo() {
      if (!apiToken) {
        setVideoSource("");
        return;
      }

      try {
        const res = await fetch(`${apiBase}/api/video/${lesson._id}`, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
          signal: abortController.signal,
        });
        if (!res.ok) {
          throw new Error(`Failed to load video. Status: ${res.status}`);
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setVideoSource(objectUrl);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Failed to load authenticated video:", error);
          setVideoSource("");
        }
      }
    }

    loadVideo();

    return () => {
      abortController.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [apiBase, apiToken, lesson._id]);

  // 1. Sync progress coordinates to backend Express API
  const syncProgress = async (watched: number, total: number) => {
    if (!watched || !total || isNaN(watched) || isNaN(total)) return;
    if (!apiToken) return;

    try {
      await fetch(`${apiBase}/api/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`
        },
        body: JSON.stringify({
          lessonId: lesson._id,
          watchedSeconds: Math.floor(watched),
          duration: Math.floor(total)
        })
      });
    } catch (err) {
      console.error("Failed to sync video playback progress to database:", err);
    }
  };

  // 2. Resume playback and reset state on lesson switch
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset current time tracker
    currentTimeRef.current = 0;
    
    // Forces clean video element reload
    video.load();

    const handleLoadedMetadata = () => {
      const watched = lesson.progress?.watchedSeconds || 0;
      const total = lesson.duration || video.duration || 0;
      
      // Resume from last watched position if valid (omit if watched is near the very end)
      if (watched > 0 && watched < total - 10) {
        video.currentTime = watched;
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [lesson._id]);

  // 3. Periodic synchronization (sync progress every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && video.duration && !video.paused && !video.ended) {
        syncProgress(currentTimeRef.current, video.duration);
      }
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [lesson._id]);

  // 4. Update play coordinates in refs on tick updates (no re-renders)
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      currentTimeRef.current = videoRef.current.currentTime;
    }
  };

  // 5. Complete lesson immediately when video finishes naturally
  const handleVideoEnded = async () => {
    if (videoRef.current && videoRef.current.duration) {
      const dur = videoRef.current.duration;
      // Mark 100% completed
      await syncProgress(dur, dur);
    }
    onComplete();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto select-none">
      
      {/* Premium Video Frame Container */}
      <div className="relative overflow-hidden rounded-2xl bg-black shadow-lg ring-1 ring-slate-900/10 aspect-video">
        <video
          ref={videoRef}
          src={videoSource}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          controls
          preload="metadata"
          playsInline
          className="h-full w-full object-contain"
        />
        {!videoSource && (
          <div className="absolute inset-0 grid place-items-center bg-black text-sm font-bold text-white">
            Loading secure video...
          </div>
        )}
      </div>

      {/* Lesson Metadata details section */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/60 shadow-sm space-y-6">
        
        {/* Title and descriptions */}
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-forest">
            Active Lesson
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-snug">
            {lesson.title}
          </h1>
          {lesson.description && (
            <p className="text-sm font-semibold text-slate-600 leading-relaxed pt-2">
              {lesson.description}
            </p>
          )}
        </div>

        {/* Lesson Downloadable Resources Section */}
        {lesson.resources && lesson.resources.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-1.5">
              <span>📎</span> Downloadable Resources
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {lesson.resources.map((res, index) => (
                <a
                  key={index}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 hover:border-forest transition duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-forest"
                >
                  <span className="text-2xl" role="img" aria-label="File icon">📄</span>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-black text-slate-900 truncate">{res.label}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Download document</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible Lesson Accessibility Transcript Section */}
        {lesson.transcript && (
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
              className="flex items-center justify-between w-full text-left text-sm font-black uppercase tracking-wider text-slate-800 hover:text-forest transition-colors focus:outline-none focus:ring-2 focus:ring-forest rounded p-1"
            >
              <span className="flex items-center gap-1.5">
                <span>💬</span> Accessibility Transcript
              </span>
              <span className="text-xs font-black text-slate-500">
                {isTranscriptOpen ? "COLLAPSE ▲" : "EXPAND ▼"}
              </span>
            </button>
            
            {isTranscriptOpen && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-inner">
                <div className="overflow-y-auto max-h-[200px] scrollbar-thin text-sm font-medium leading-relaxed text-slate-600 space-y-3 whitespace-pre-line">
                  {lesson.transcript}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
