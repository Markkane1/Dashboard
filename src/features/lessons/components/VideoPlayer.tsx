"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Lesson } from "@/shared/types";
import { logger } from '@/shared/logger';

interface VideoPlayerProps {
  lesson: Lesson;
  onComplete: () => void;
}

export default function VideoPlayer({ lesson, onComplete }: VideoPlayerProps) {
  const { data: session } = useSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentTimeRef = useRef(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoError, setVideoError] = useState("");
  const apiToken = session?.apiAccessToken;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const videoSource = apiToken ? `/api/video/${encodeURIComponent(lesson._id)}` : "";

  useEffect(() => {
    setIsVideoReady(false);
    setVideoError("");
  }, [lesson._id, apiToken]);

  // 1. Sync progress coordinates to backend Express API
  const syncProgress = useCallback(async (watched: number, total: number) => {
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
      logger.error("Failed to sync video playback progress to database:", err);
    }
  }, [apiBase, apiToken, lesson._id]);

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
  }, [lesson._id, lesson.duration, lesson.progress?.watchedSeconds]);

  const handleVideoReady = () => {
    setIsVideoReady(true);
    setVideoError("");
  };

  const handleVideoError = () => {
    const video = videoRef.current;
    const mediaError = video?.error;
    const errorMessage = mediaError
      ? `Video could not be played (media error ${mediaError.code}).`
      : "Video could not be played.";

    logger.error("Video playback error:", {
      lessonId: lesson._id,
      code: mediaError?.code,
      message: mediaError?.message,
    });
    setIsVideoReady(false);
    setVideoError(errorMessage);
  };

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
  }, [lesson._id, syncProgress]);

  useEffect(() => {
    if (isTranscriptOpen) {
      transcriptRef.current?.focus();
    }
  }, [isTranscriptOpen]);

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
    <div className="mx-auto max-w-4xl min-w-0 space-y-6 select-none">
      
      {/* Premium Video Frame Container */}
      <div className="relative overflow-hidden rounded-2xl bg-black shadow-lg ring-1 ring-slate-900/10 aspect-video">
        <video
          ref={videoRef}
          src={videoSource}
          key={lesson._id}
          onLoadedMetadata={handleVideoReady}
          onCanPlay={handleVideoReady}
          onError={handleVideoError}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          controls
          preload="metadata"
          playsInline
          className="h-full w-full object-contain"
        />
        {!videoSource && (
          <div className="absolute inset-0 grid place-items-center bg-black text-sm font-bold text-white">
            Sign in to load this secure video.
          </div>
        )}
        {videoSource && !isVideoReady && !videoError && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/70 text-sm font-bold text-white">
            Loading secure video...
          </div>
        )}
        {videoError && (
          <div className="absolute inset-0 grid place-items-center bg-black p-6 text-center text-sm font-bold text-white">
            <div>
              <p>{videoError}</p>
              <p className="mt-2 text-xs font-semibold text-white/70">
                Check that this lesson has a valid MP4 file and that you are enrolled in the course.
              </p>
            </div>
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
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {lesson.resources.map((res, index) => (
                <a
                  key={index}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 hover:border-forest transition duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-forest"
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
              aria-expanded={isTranscriptOpen}
              aria-controls="lesson-transcript"
              aria-label={`${isTranscriptOpen ? "Collapse" : "Expand"} lesson transcript`}
              className="flex w-full flex-col gap-2 rounded p-1 text-left text-sm font-black uppercase tracking-wider text-slate-800 transition-colors hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
            >
              <span className="flex items-center gap-1.5">
                <span>💬</span> Accessibility Transcript
              </span>
              <span className="text-xs font-black text-slate-500">
                {isTranscriptOpen ? "Collapse" : "Expand"}
              </span>
            </button>
            
            {isTranscriptOpen && (
              <div
                id="lesson-transcript"
                ref={transcriptRef}
                tabIndex={-1}
                role="region"
                aria-label="Lesson transcript"
                className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-inner"
              >
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
