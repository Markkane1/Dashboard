import React from "react";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-8 min-h-screen">
      {/* Skeleton Header */}
      <div className="space-y-3 animate-pulse">
        <div className="h-8 w-full max-w-64 rounded-lg bg-slate-200" />
        <div className="h-4 w-full max-w-96 rounded-md bg-slate-200" />
      </div>

      {/* Grid: 3 columns, 4 rows of gray pulsing rounded rectangles */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse bg-slate-200 rounded-xl h-64 w-full shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}
