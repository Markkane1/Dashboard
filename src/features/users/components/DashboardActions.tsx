"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { markComplete, unenrollCourse } from "@/features/enrollments/actions";

interface ActionProps {
  courseId: string;
}

export function MarkCompleteButton({ courseId }: ActionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const response = await markComplete(courseId);
      if (response.success) {
        router.refresh();
      } else {
        alert(response.error || "Failed to mark course as completed.");
      }
    } catch (error) {
      console.error("Complete course error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleComplete}
      disabled={isLoading}
      className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
    >
      {isLoading ? "Completing..." : "Mark Complete ✓"}
    </button>
  );
}

export function UnenrollButton({ courseId }: ActionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleUnenroll = async () => {
    if (!confirm("Are you sure you want to unenroll from this course?")) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await unenrollCourse(courseId);
      if (response.success) {
        router.refresh();
      } else {
        alert(response.error || "Failed to unenroll.");
      }
    } catch (error) {
      console.error("Unenroll course error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleUnenroll}
      disabled={isLoading}
      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
    >
      {isLoading ? "Unenrolling..." : "Unenroll"}
    </button>
  );
}

export function DownloadCertificateButton({ courseId }: { courseId: string }) {
  return (
    <a
      href={`/api/certificates/${courseId}`}
      className="mt-3 block w-full rounded-md bg-forest py-2 text-center text-xs font-bold text-white hover:bg-emerald-800 transition-colors"
    >
      Download Certificate
    </a>
  );
}
