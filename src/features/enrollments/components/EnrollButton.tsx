"use client";

import React, { useState } from "react";
import { logger } from "@/shared/logger";
import { useRouter } from "next/navigation";
import { Link } from "@/shared/navigation";
import { enrollInCourse } from "@/features/auth/actions";

interface EnrollButtonProps {
  courseId: string;
  isAuthenticated: boolean;
  initialEnrolled: boolean;
  canContinueLearning?: boolean;
}

export default function EnrollButton({
  courseId,
  isAuthenticated,
  initialEnrolled,
  canContinueLearning = true,
}: EnrollButtonProps) {
  const router = useRouter();
  const [isEnrolled, setIsEnrolled] = useState(initialEnrolled);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      const returnUrl = `/courses/${encodeURIComponent(courseId)}`;
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(returnUrl)}&returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await enrollInCourse(courseId);
      if (response.success) {
        setIsEnrolled(true);
        router.refresh();
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
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <div className="inline-flex items-center justify-center rounded-md border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-black text-teal-700">
          Already enrolled
        </div>
        {canContinueLearning ? (
          <Link href={`/courses/${encodeURIComponent(courseId)}/learn`} className="btn-primary">
            Continue learning
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="inline-flex w-full flex-col gap-2 sm:w-auto">
      <button onClick={handleEnroll} disabled={isLoading} className="btn-primary w-full sm:w-auto">
        {isLoading ? "Enrolling..." : "Enroll in this course"}
      </button>
      {error && <span className="text-xs font-bold text-red-600">{error}</span>}
    </div>
  );
}
