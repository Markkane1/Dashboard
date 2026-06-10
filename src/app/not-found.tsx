import React from "react";
import { Link } from "@/shared/navigation";

export default function NotFound() {
  return (
    <div className="bg-gray-50 min-h-[70vh] flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-md w-full text-center space-y-6">
        <span className="inline-block text-7xl animate-bounce">🌱</span>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-950 tracking-tight">
            Page not found
          </h1>
          <p className="text-sm font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/"
            className="rounded-md bg-forest px-5 py-3 text-sm font-black text-white hover:bg-emerald-800 transition-colors shadow-sm"
          >
            Back to home
          </Link>
          <Link
            href="/courses"
            className="rounded-md bg-white px-5 py-3 text-sm font-black text-forest ring-1 ring-emerald-200 hover:bg-emerald-50 transition-colors shadow-sm"
          >
            Browse courses
          </Link>
        </div>
      </div>
    </div>
  );
}
