"use client";

import React, { useEffect } from "react";
import { Link } from "@/shared/navigation";
import { logger } from '@/shared/logger';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CourseError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error("Course Error Boundary caught error:", error);
  }, [error]);

  return (
    <div className="bg-gray-50 min-h-[70vh] flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-md w-full text-center space-y-6">
        <span className="inline-block text-7xl" role="img" aria-label="Book icon">
          📚
        </span>

        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">
            Could not load this course
          </h1>
          <p className="text-sm font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
            We had trouble loading the details for this course. It might not exist or there was a connection issue.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <button
            onClick={() => reset()}
            className="rounded-md bg-forest px-5 py-3 text-sm font-black text-white hover:bg-emerald-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md bg-white px-5 py-3 text-sm font-black text-forest ring-1 ring-emerald-200 hover:bg-emerald-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
          >
            Back to catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
