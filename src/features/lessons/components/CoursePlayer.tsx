"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/shared/navigation";
import { Assignment, Lesson } from "@/shared/types";
import VideoPlayer from "./VideoPlayer";
import LessonSidebar from "./LessonSidebar";

interface CoursePlayerProps {
  courseId: string;
  courseCertificateEligible?: boolean;
  courseRequiresVerifiedProgress?: boolean;
  lessons: Lesson[];
  assignments?: Assignment[];
  initialLesson: Lesson;
}

export default function CoursePlayer({
  courseId,
  courseCertificateEligible = false,
  courseRequiresVerifiedProgress = false,
  lessons,
  assignments = [],
  initialLesson
}: CoursePlayerProps) {
  const router = useRouter();
  const [activeLesson, setActiveLesson] = useState<Lesson>(initialLesson);
  const [lessonList, setLessonList] = useState(lessons);
  const [assignmentList, setAssignmentList] = useState(assignments);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [submittingAssignmentId, setSubmittingAssignmentId] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const allLessonsCompleted = lessonList.length > 0 && lessonList.every((lesson) => lesson.progress.completed);
  const activeAssignments = assignmentList.filter((assignment) => (
    assignment.lessonId === activeLesson._id ||
    activeLesson.assignmentIds?.includes(assignment.id)
  ));

  // Sync state with props when server-side updates occur
  useEffect(() => {
    setLessonList(lessons);
    setActiveLesson((prev) => {
      const updated = lessons.find((l) => l._id === prev._id);
      return updated ? updated : prev;
    });
  }, [lessons]);

  useEffect(() => {
    setAssignmentList(assignments);
  }, [assignments]);

  const submitAssignment = useCallback(async (assignmentId: string, formData: FormData) => {
    setSubmissionMessage("");
    setSubmissionError("");
    setSubmittingAssignmentId(assignmentId);
    try {
      const res = await fetch(`/api/admin/assignments/${encodeURIComponent(assignmentId)}/submissions`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Assignment submission failed.");
      setAssignmentList((current) => current.map((assignment) => (
        assignment.id === assignmentId ? { ...assignment, mySubmission: data } : assignment
      )));
      setSubmissionMessage("Assignment submitted for trainer review.");
      router.refresh();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Assignment submission failed.");
    } finally {
      setSubmittingAssignmentId("");
    }
  }, [router]);

  // Sync lesson switch state with URL search param without triggers scroll resets
  const handleSelectLesson = useCallback((lesson: Lesson) => {
    setActiveLesson(lesson);
    setIsMobileSidebarOpen(false);
    router.replace(
      `/courses/${encodeURIComponent(courseId)}/learn?lesson=${encodeURIComponent(lesson._id)}`,
      { scroll: false }
    );
  }, [courseId, router]);

  // Keep local state updated during playback progress syncing
  const handleProgressUpdate = useCallback((watchedSeconds: number, completed: boolean) => {
    const seconds = Math.floor(watchedSeconds);

    setLessonList((prevList) =>
      prevList.map((l) => {
        if (l._id === activeLesson._id) {
          return {
            ...l,
            progress: {
              watchedSeconds: seconds,
              completed: completed || l.progress.completed
            }
          };
        }
        return l;
      })
    );

    setActiveLesson((prev) => {
      if (prev._id === activeLesson._id) {
        return {
          ...prev,
          progress: {
            watchedSeconds: seconds,
            completed: completed || prev.progress.completed
          }
        };
      }
      return prev;
    });
  }, [activeLesson._id]);

  // Called when active lesson video reaches natural playback completion
  const handleLessonComplete = useCallback(() => {
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

    // Sync activeLesson state
    setActiveLesson(prev => {
      if (prev._id === activeLesson._id) {
        return {
          ...prev,
          progress: { watchedSeconds: prev.duration, completed: true }
        };
      }
      return prev;
    });

    // Refresh server state asynchronously
    router.refresh();

    // 2. Automatically navigate to the next incomplete or adjacent lesson in order
    const currentIndex = updatedLessons.findIndex((l) => l._id === activeLesson._id);
    const nextLesson = updatedLessons[currentIndex + 1] || updatedLessons[0];

    if (nextLesson && nextLesson._id !== activeLesson._id) {
      handleSelectLesson(nextLesson);
    }
  }, [activeLesson._id, handleSelectLesson, lessonList, router]);

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
            courseCertificateEligible={courseCertificateEligible}
            courseRequiresVerifiedProgress={courseRequiresVerifiedProgress}
            onComplete={handleLessonComplete}
            onProgressUpdate={handleProgressUpdate}
          />

        {activeAssignments.length > 0 && (
          <section className="mx-auto mt-6 max-w-4xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-black text-slate-950">Assignments</h2>
              <p className="text-sm font-semibold text-slate-600">Submit required evidence for trainer review.</p>
            </div>
            {submissionMessage && <p className="mb-3 rounded-md bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{submissionMessage}</p>}
            {submissionError && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm font-bold text-red-800">{submissionError}</p>}
            <div className="space-y-4">
              {activeAssignments.map((assignment) => (
                <form
                  key={assignment.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitAssignment(assignment.id, new FormData(event.currentTarget));
                  }}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-950">{assignment.title}</p>
                      {assignment.instructions && <p className="mt-1 text-sm font-semibold text-slate-600">{assignment.instructions}</p>}
                      {assignment.dueAt && <p className="mt-1 text-xs font-bold text-slate-500">Due {new Date(assignment.dueAt).toLocaleDateString()}</p>}
                    </div>
                    {assignment.mySubmission && (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
                        {assignment.mySubmission.status.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  {assignment.mySubmission?.reviewComments && (
                    <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-bold text-amber-900">{assignment.mySubmission.reviewComments}</p>
                  )}
                  <div className="mt-3 grid gap-3">
                    <textarea name="text" rows={3} placeholder="Submission notes" defaultValue={assignment.mySubmission?.text || ""} className="control w-full" />
                    <input name="linkUrl" type="url" placeholder="Evidence link" defaultValue={assignment.mySubmission?.linkUrl || ""} className="control w-full" />
                    <input name="file" type="file" className="control w-full" />
                    {assignment.mySubmission?.fileName && (
                      <a
                        href={`/api/admin/assignments/submissions/${encodeURIComponent(assignment.mySubmission.id)}/file`}
                        className="text-sm font-bold text-teal-700"
                      >
                        Download submitted file
                      </a>
                    )}
                  </div>
                  <button type="submit" disabled={submittingAssignmentId === assignment.id} className="btn-primary mt-3">
                    {submittingAssignmentId === assignment.id ? "Submitting..." : "Submit assignment"}
                  </button>
                </form>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
