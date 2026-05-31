"use client";

import React, { useState } from "react";
import { logger } from '@/shared/logger';
import { useRouter } from "next/navigation";
import { enrollInCourse } from "@/features/auth/actions";

interface EnrollButtonProps {
  courseId: string;
  isAuthenticated: boolean;
  initialEnrolled: boolean;
}

export default function EnrollButton({
  courseId,
  isAuthenticated,
  initialEnrolled,
}: EnrollButtonProps) {
  const router = useRouter();
  const [isEnrolled, setIsEnrolled] = useState(initialEnrolled);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      // Redirect to login with returnUrl param as requested
      const returnUrl = `/courses/${courseId}`;
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(returnUrl)}&returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await enrollInCourse(courseId);
      if (response.success) {
        setIsEnrolled(true);
        router.refresh(); // Refresh session/page data on server
      } else {
        setError(response.error || "Enrollment failed.");
      }
    } catch (err) {
      logger.error("Enrollment error:", err);
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isEnrolled) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-5 py-3 text-sm font-black text-forest">
        <span>✓</span> Already enrolled
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-2">
      <button
        onClick={handleEnroll}
        disabled={isLoading}
        className="rounded-lg bg-forest px-6 py-3 text-sm font-black text-white hover:bg-emerald-800 transition-colors disabled:opacity-50"
      >
        {isLoading ? "Enrolling..." : "Enroll in this course"}
      </button>
      {error && <span className="text-xs font-bold text-red-600">⚠️ {error}</span>}
    </div>
  );
}
