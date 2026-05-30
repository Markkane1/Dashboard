"use client";

import React, { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Global Error Boundary caught error:", error);
  }, [error]);

  return (
    <div className="bg-gray-50 min-h-[70vh] flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-md w-full text-center space-y-6">
        <span className="inline-block text-7xl animate-pulse" role="img" aria-label="Warning icon">
          ⚠️
        </span>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
            An unexpected error occurred. Please try again.
          </p>
        </div>

        <div className="flex justify-center pt-4">
          <button
            onClick={() => reset()}
            className="rounded-md bg-forest px-5 py-3 text-sm font-black text-white hover:bg-emerald-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 focus:ring-opacity-50"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
