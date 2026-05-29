"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { Course, CourseModule, Chapter } from "@/core/domain/entities/Course";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function CoursePlayerPage({ params }: PageProps) {
  // Unwrap parameters using React.use() to comply with Next.js App Router guidelines
  const resolvedParams = use(params);
  const courseId = resolvedParams.slug;

  // State managers
  const [course, setCourse] = useState<Course | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({ 0: true }); // first module open by default
  const [completedChapters, setCompletedChapters] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Custom Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Fetch Course data and Student Progress in parallel
  useEffect(() => {
    const loadCourseAndProgress = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch full course details
        const res = await fetch(`/api/courses?id=${courseId}`);
        const resData = await res.json();
        
        if (!resData.success) {
          setError(resData.error || "Course syllabus could not be loaded.");
          setIsLoading(false);
          return;
        }

        setCourse(resData.data);

        // 2. Fetch logged-in user's Progress record from MongoDB
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();
        const sessionUserId = session?.user?.id || "";
        setCurrentUserId(sessionUserId);

        const completedMap: Record<string, boolean> = {};
        if (sessionUserId) {
          const progressRes = await fetch(`/api/progress?userId=${sessionUserId}&courseId=${courseId}`);
          const progressData = await progressRes.json();
          
          if (progressData.success && progressData.data) {
            const completedArr: string[] = progressData.data.completedChapters || [];
            completedArr.forEach((slug) => {
              completedMap[slug] = true;
            });
            setCompletedChapters(completedMap);
          }
        }

        // Set first chapter of first module active by default
        const firstMod = resData.data.modules?.[0];
        const firstChap = firstMod?.chapters?.[0];
        if (firstChap) {
          setActiveChapter(firstChap);
        }
      } catch (e) {
        console.error(e);
        setError("Error loading server-side course player.");
      } finally {
        setIsLoading(false);
      }
    };

    loadCourseAndProgress();
  }, [courseId]);

  // Create flat list of chapters in order to calculate gatekeep index
  const allChapters: Chapter[] = [];
  course?.modules?.forEach((mod) => {
    mod.chapters?.forEach((chap) => {
      allChapters.push(chap);
    });
  });

  // Check if a chapter is unlocked sequentially
  const isChapterUnlocked = (chapSlug: string): boolean => {
    const idx = allChapters.findIndex((c) => c.slug === chapSlug);
    if (idx <= 0) return true; // First chapter is always unlocked by default
    const prevChap = allChapters[idx - 1];
    return !!completedChapters[prevChap.slug]; // Unlocked if preceding chapter is completed
  };

  // Toggle Module accordion tree
  const toggleModule = (index: number) => {
    setExpandedModules(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Handle Chapter selection (checks sequential lock)
  const handleSelectChapter = (chap: Chapter) => {
    if (!isChapterUnlocked(chap.slug)) {
      showToast("🔒 Complete the preceding chapter first to unlock this content.");
      return;
    }
    setActiveChapter(chap);
  };

  // Toggle Chapter completed checklist (Calls API with $addToSet logic)
  const handleToggleComplete = async (chapterSlug: string) => {
    if (!currentUserId) {
      showToast("❌ Register or sign in to track and persist completion progress!");
      return;
    }

    // If already completed, just toggle locally for visual responsiveness, or let it stick
    if (completedChapters[chapterSlug]) {
      // Allow toggle back or keep complete to represent sequential stability
      setCompletedChapters(prev => ({ ...prev, [chapterSlug]: false }));
      return;
    }

    try {
      const res = await fetch("/api/progress/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          courseId: courseId,
          chapterId: chapterSlug,
        }),
      });

      const resData = await res.json();
      if (resData.success) {
        setCompletedChapters(prev => ({
          ...prev,
          [chapterSlug]: true
        }));
        showToast("✓ Chapter completed! Next chapter is now unlocked.");
      } else {
        showToast(resData.error || "Failed to sync completion progress.");
      }
    } catch (e) {
      console.error(e);
      showToast("Server connection error syncing progress.");
    }
  };

  // Calculate syllabus completion percentage
  const totalChaptersCount = allChapters.length;
  const completedCount = Object.values(completedChapters).filter(Boolean).length;
  const progressPercent = totalChaptersCount > 0 ? Math.round((completedCount / totalChaptersCount) * 100) : 0;

  // Premium Custom Markdown Parser (Safe, zero-dependency, and blazing fast)
  const parseMarkdown = (markdown: string) => {
    if (!markdown) return null;
    const lines = markdown.split("\n");
    return lines.map((line, idx) => {
      const cleanLine = line.trim();

      // Heading 3
      if (cleanLine.startsWith("###")) {
        return <h3 key={idx} className="md-h3">{cleanLine.replace("###", "").trim()}</h3>;
      }
      // Heading 2
      if (cleanLine.startsWith("##")) {
        return <h2 key={idx} className="md-h2">{cleanLine.replace("##", "").trim()}</h2>;
      }
      // Heading 1
      if (cleanLine.startsWith("#")) {
        return <h1 key={idx} className="md-h1">{cleanLine.replace("#", "").trim()}</h1>;
      }
      // Bullet list item
      if (cleanLine.startsWith("-") || cleanLine.startsWith("*")) {
        return (
          <li key={idx} className="md-li">
            {parseInlineStyles(cleanLine.substring(1).trim())}
          </li>
        );
      }
      // Paragraph empty spacer
      if (cleanLine === "") {
        return <div key={idx} className="md-spacer"></div>;
      }
      // Standard Text Paragraph with bold mapping
      return <p key={idx} className="md-p">{parseInlineStyles(cleanLine)}</p>;
    });
  };

  // Parse inline bold syntax (e.g. **text**)
  const parseInlineStyles = (text: string) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} className="md-strong">{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  if (isLoading) {
    return (
      <div className="player-loading-container">
        <div className="spinner"></div>
        <p>Loading course environment...</p>
        <style jsx>{`
          .player-loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: hsl(var(--background));
            color: hsl(var(--muted));
            gap: 1rem;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(139, 92, 246, 0.1);
            border-radius: 50%;
            border-top-color: hsl(var(--primary));
            animation: spin 1s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="player-error-container">
        <h3>Syllabus Error</h3>
        <p>{error || "Course player could not be rendered."}</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Return to Dashboard
        </Link>
        <style jsx>{`
          .player-error-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: hsl(var(--background));
            color: #ffffff;
            padding: 2rem;
            text-align: center;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="player-viewport">
      {/* Dynamic Slide-in Toast Notifications inside player */}
      {toastMessage && (
        <div className="player-toast-box">
          <span className="toast-text">{toastMessage}</span>
        </div>
      )}

      {/* 1. Left Accordion Sidebar */}
      <aside className="player-sidebar glass-card">
        <div className="sidebar-header">
          <Link href="/" className="back-link">
            ← Dashboard
          </Link>
          <h2 className="sidebar-course-title">{course.title}</h2>
          
          <div className="progress-widget">
            <div className="progress-text-row">
              <span>Syllabus Completion</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        </div>

        <div className="sidebar-accordion-area">
          {course.modules && course.modules.length > 0 ? (
            course.modules.map((mod: CourseModule, modIdx: number) => {
              const isOpen = expandedModules[modIdx];
              return (
                <div key={modIdx} className="accordion-item">
                  <button onClick={() => toggleModule(modIdx)} className={`accordion-trigger ${isOpen ? "active" : ""}`}>
                    <span className="accordion-trigger-title">{mod.title}</span>
                    <span className="accordion-chevron">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  
                  {isOpen && (
                    <div className="accordion-content">
                      {mod.chapters?.map((chap: Chapter) => {
                        const isCurrent = activeChapter?.slug === chap.slug;
                        const isCompleted = !!completedChapters[chap.slug];
                        const isUnlocked = isChapterUnlocked(chap.slug);
                        
                        return (
                          <div
                            key={chap.slug}
                            onClick={() => handleSelectChapter(chap)}
                            className={`chapter-link ${isCurrent ? "current" : ""} ${isCompleted ? "completed" : ""} ${isUnlocked ? "" : "locked"}`}
                          >
                            <div className="chapter-meta-left">
                              <span className={`chapter-checkbox-circle ${isUnlocked ? "" : "circle-locked"}`}>
                                {isCompleted ? "✓" : isUnlocked ? "" : "🔒"}
                              </span>
                              <span className="chapter-title-text">{chap.title}</span>
                            </div>
                            {isUnlocked ? (
                              <span className="chapter-minutes">{chap.estimatedMinutes}m</span>
                            ) : (
                              <span className="chapter-minutes" style={{ fontSize: "0.65rem", color: "hsl(var(--destructive))" }}>Locked</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="empty-sidebar-msg">No curriculum modules available.</div>
          )}
        </div>
      </aside>

      {/* 2. Main Right Markdown Canvas */}
      <main className="player-canvas">
        {activeChapter ? (
          <div className="canvas-container">
            <header className="canvas-header glass-card">
              <div className="header-chapter-path">
                <span>CURRICULUM MODULE CHAPTER</span>
              </div>
              <div className="header-title-row">
                <h3 className="canvas-chapter-title">{activeChapter.title}</h3>
                
                <button
                  onClick={() => handleToggleComplete(activeChapter.slug)}
                  className={`btn ${completedChapters[activeChapter.slug] ? "btn-secondary" : "btn-primary"} btn-sm`}
                  style={{ minWidth: "150px" }}
                >
                  {completedChapters[activeChapter.slug] ? "✓ Completed" : "Mark as Complete"}
                </button>
              </div>
            </header>

            <article className="canvas-markdown-body glass-card">
              {parseMarkdown(activeChapter.contentMarkdown)}
            </article>
          </div>
        ) : (
          <div className="canvas-empty-state">
            <h4>Select a chapter to begin learning</h4>
            <p>Expand modules in the sidebar accordion to navigate chapters sequentially.</p>
          </div>
        )}
      </main>

      {/* Embedded CSS scopes for strict grid layouts, accordion animations, and markdown styling */}
      <style jsx global>{`
        .player-viewport {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          background-color: hsl(var(--background));
          background-image: 
            radial-gradient(at 0% 0%, hsla(262, 83%, 58%, 0.05) 0px, transparent 40%),
            radial-gradient(at 100% 100%, hsla(187, 92%, 46%, 0.03) 0px, transparent 40%);
        }

        /* Player Toast Box */
        .player-toast-box {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2200;
          background: rgba(10, 13, 24, 0.95);
          border: 1px solid var(--glass-border);
          border-left: 4px solid hsl(var(--primary));
          backdrop-filter: blur(12px);
          padding: 0.85rem 1.5rem;
          border-radius: var(--radius-md);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          animation: slideUpIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          max-width: 380px;
        }

        .toast-text {
          font-size: 0.85rem;
          font-weight: 600;
          color: #ffffff;
        }

        /* Sidebar styles */
        .player-sidebar {
          width: 360px;
          height: 100%;
          border-radius: 0;
          border-right: 1px solid var(--glass-border);
          border-left: none;
          border-top: none;
          border-bottom: none;
          background: rgba(8, 10, 19, 0.95);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          z-index: 10;
        }

        .sidebar-header {
          padding: 1.75rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .back-link {
          font-size: 0.8rem;
          color: hsl(var(--secondary));
          font-weight: 600;
          display: inline-block;
          margin-bottom: 0.75rem;
          transition: transform 0.2s ease;
        }

        .back-link:hover {
          color: #ffffff;
          transform: translateX(-2px);
        }

        .sidebar-course-title {
          font-size: 1.15rem;
          font-weight: 800;
          line-height: 1.25;
          margin-bottom: 1.25rem;
          color: #ffffff;
        }

        .progress-widget {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .progress-text-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          font-weight: 700;
          color: hsl(var(--muted));
        }

        .progress-bar-bg {
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)));
          border-radius: var(--radius-full);
          transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .sidebar-accordion-area {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 0;
        }

        .accordion-item {
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .accordion-trigger {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.15rem 1.5rem;
          cursor: pointer;
          transition: background 0.2s ease;
          text-align: left;
          background: none;
          border: none;
        }

        .accordion-trigger:hover {
          background: rgba(255, 255, 255, 0.01);
        }

        .accordion-trigger-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: hsl(var(--foreground));
        }

        .accordion-trigger.active .accordion-trigger-title {
          color: hsl(var(--primary));
        }

        .accordion-chevron {
          font-size: 0.7rem;
          color: hsl(var(--muted));
          transition: transform 0.25s ease;
        }

        .accordion-content {
          background: rgba(0, 0, 0, 0.15);
          border-top: 1px solid rgba(255, 255, 255, 0.01);
        }

        .chapter-link {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.85rem 1.5rem 0.85rem 1.75rem;
          cursor: pointer;
          font-size: 0.8rem;
          color: hsl(var(--muted));
          transition: all 0.2s ease;
          border-left: 2px solid transparent;
        }

        .chapter-link:hover {
          background: rgba(255, 255, 255, 0.02);
          color: #ffffff;
        }

        .chapter-link.locked {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .chapter-link.locked:hover {
          background: none;
          color: hsl(var(--muted));
        }

        .chapter-link.current {
          background: rgba(139, 92, 246, 0.06);
          color: #ffffff;
          font-weight: 600;
          border-left-color: hsl(var(--primary));
        }

        .chapter-meta-left {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex: 1;
        }

        .chapter-checkbox-circle {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6rem;
          font-weight: bold;
          color: transparent;
          transition: all 0.2s ease;
          background: rgba(0,0,0,0.2);
        }

        .chapter-checkbox-circle.circle-locked {
          border-color: rgba(255, 255, 255, 0.05);
          font-size: 0.65rem;
        }

        .chapter-link.completed .chapter-checkbox-circle {
          border-color: transparent;
          background: #10b981;
          color: #ffffff;
        }

        .chapter-title-text {
          line-height: 1.35;
        }

        .chapter-minutes {
          font-size: 0.72rem;
          color: hsl(var(--muted));
          opacity: 0.6;
          padding-left: 0.5rem;
        }

        .empty-sidebar-msg {
          padding: 2rem;
          text-align: center;
          font-size: 0.8rem;
          color: hsl(var(--muted));
        }

        /* Right Canvas styles */
        .player-canvas {
          flex: 1;
          height: 100%;
          overflow-y: auto;
          padding: 2rem;
        }

        .canvas-container {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .canvas-header {
          padding: 1.5rem 2rem;
          background: rgba(10, 12, 22, 0.4);
        }

        .header-chapter-path {
          font-size: 0.65rem;
          font-weight: 800;
          color: hsl(var(--secondary));
          letter-spacing: 0.08em;
          margin-bottom: 0.4rem;
        }

        .header-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .canvas-chapter-title {
          font-size: 1.45rem;
          font-weight: 800;
          color: #ffffff;
          line-height: 1.2;
        }

        .canvas-markdown-body {
          padding: 2.5rem;
          background: rgba(10, 12, 22, 0.4);
          min-height: 500px;
          line-height: 1.7;
          font-size: 0.95rem;
        }

        /* Custom Markdown styling rules */
        .md-h1 {
          font-size: 1.75rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 0.5rem;
        }

        .md-h2 {
          font-size: 1.4rem;
          font-weight: 700;
          color: #ffffff;
          margin-top: 1.75rem;
          margin-bottom: 1rem;
        }

        .md-h3 {
          font-size: 1.15rem;
          font-weight: 600;
          color: hsl(var(--secondary));
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .md-p {
          color: hsl(var(--foreground) / 0.85);
          margin-bottom: 1rem;
        }

        .md-strong {
          color: #ffffff;
          font-weight: 700;
        }

        .md-li {
          color: hsl(var(--foreground) / 0.85);
          margin-left: 1.5rem;
          margin-bottom: 0.5rem;
          list-style-type: square;
        }

        .md-spacer {
          height: 1rem;
        }

        /* Canvas Empty State */
        .canvas-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 400px;
          color: hsl(var(--muted));
          text-align: center;
          gap: 0.5rem;
        }

        .canvas-empty-state h4 {
          font-size: 1.25rem;
          color: #ffffff;
        }

        @keyframes slideUpIn {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
