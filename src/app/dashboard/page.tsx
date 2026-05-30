import React from "react";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { findUserByEmail } from "@/lib/data/userDb";
import { courses } from "@/lib/data/courses";
import CourseCard from "@/components/CourseCard";
import { Link } from "@/navigation";
import {
  MarkCompleteButton,
  UnenrollButton,
  DownloadCertificateButton,
} from "@/components/DashboardActions";

export default async function DashboardPage() {
  // Get active session securely on the server
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    redirect("/auth/login");
  }

  // Look up user from users.json filesystem database
  const user = await findUserByEmail(session.user.email);
  const enrolledIds = user?.enrolledCourses || [];
  const completedIds = user?.completedCourses || [];

  // Filter in-progress courses (enrolled but not completed)
  const inProgressIds = enrolledIds.filter((id) => !completedIds.includes(id));

  // Map IDs to original course records
  const inProgressCourses = courses.filter((c) => inProgressIds.includes(c.id));
  const completedCourses = courses.filter((c) => completedIds.includes(c.id));

  const stats = [
    { name: "Courses enrolled", value: enrolledIds.length, icon: "📚" },
    { name: "Courses completed", value: completedIds.length, icon: "🎓" },
    { name: "Certificates earned", value: completedIds.length, icon: "🏆" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
      
      {/* 1. Welcome Header */}
      <div className="rounded-2xl bg-gradient-to-r from-forest to-emerald-800 p-8 text-white shadow-sm lg:p-10 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 text-9xl font-bold select-none translate-y-12 translate-x-4">
          EPA
        </div>
        <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
          Your Learning Journey
        </span>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
          Welcome back, {session.user.name}
        </h1>
        <p className="mt-3 max-w-xl text-emerald-100 text-sm leading-relaxed font-semibold">
          Expand your environmental law literacy at your own pace. Monitor your enrollment targets and download certifications once paths are complete.
        </p>
      </div>

      {/* 2. Stats Row */}
      <div className="grid gap-5 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 flex items-center justify-between gap-4"
          >
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-slate-500">{stat.name}</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{stat.value}</p>
            </div>
            <span className="text-4xl">{stat.icon}</span>
          </div>
        ))}
      </div>

      {/* 3. In Progress Section */}
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950 flex items-center gap-2">
          <span>⏳</span> Continue learning
        </h2>
        
        {inProgressCourses.length === 0 ? (
          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-10 text-center">
            <span className="text-4xl">🌱</span>
            <h3 className="mt-3 text-lg font-bold text-slate-800">You haven't enrolled in any courses yet.</h3>
            <p className="mt-1 text-sm text-slate-500">Explore the course catalog to enroll in our free environmental legal programs.</p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-md bg-forest px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-800 transition-colors shadow-sm"
            >
              Browse catalog
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {inProgressCourses.map((course) => (
              <CourseCard key={course.id} course={course}>
                
                {/* Fake progress bar under the card */}
                <div className="mt-5 border-t border-slate-100 pt-4 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Course Progress</span>
                    <span className="text-forest">30% Complete</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-forest rounded-full" style={{ width: "30%" }} />
                  </div>
                </div>

                {/* Dashboard Action buttons */}
                <div className="mt-4 flex gap-2 w-full pt-1">
                  <MarkCompleteButton courseId={course.id} />
                  <UnenrollButton courseId={course.id} />
                </div>

              </CourseCard>
            ))}
          </div>
        )}
      </div>

      {/* 4. Completed Section */}
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950 flex items-center gap-2">
          <span>✅</span> Completed courses
        </h2>

        {completedCourses.length === 0 ? (
          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-8 text-center text-sm font-semibold text-slate-500">
            Completed courses and earned certificates will be displayed here.
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {completedCourses.map((course) => (
              <CourseCard key={course.id} course={course}>
                
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-black text-forest">
                    <span>✓</span> Completed
                  </div>
                  
                  {/* Download certificate mock button */}
                  <DownloadCertificateButton courseTitle={course.title} />
                </div>

              </CourseCard>
            ))}
          </div>
        )}
      </div>

      {/* 5. Browse CTA Banner */}
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-8 text-center space-y-4">
        <span className="text-3xl">🌏</span>
        <h3 className="text-xl font-black text-slate-950">Discover more courses</h3>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-600 font-semibold">
          Expand your knowledge by browsing through our catalog entries mapped to United Nations standards, including biological diversity, chemical regulations, and climate litigation.
        </p>
        <Link
          href="/"
          className="inline-block rounded-md bg-forest px-6 py-3 text-sm font-black text-white hover:bg-emerald-800 transition-colors shadow-sm"
        >
          Browse catalog
        </Link>
      </div>

    </div>
  );
}
