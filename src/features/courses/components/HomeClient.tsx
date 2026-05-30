"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CourseCard from "./CourseCard";
import { categories } from "../data/categories";
import { Link } from "@/shared/navigation";
import { Course } from "@/shared/types";

// SDG official hex colors
const sdgGoals = [
  { number: 1, name: "No Poverty", color: "#E5243B" },
  { number: 2, name: "Zero Hunger", color: "#DDA63A" },
  { number: 3, name: "Good Health and Well-being", color: "#4C9F38" },
  { number: 4, name: "Quality Education", color: "#C5192D" },
  { number: 5, name: "Gender Equality", color: "#FF3A21" },
  { number: 6, name: "Clean Water and Sanitation", color: "#26BDE2" },
  { number: 7, name: "Affordable and Clean Energy", color: "#FCC30B" },
  { number: 8, name: "Decent Work and Economic Growth", color: "#A21942" },
  { number: 9, name: "Industry, Innovation and Infrastructure", color: "#FD6925" },
  { number: 10, name: "Reduced Inequalities", color: "#DD1367" },
  { number: 11, name: "Sustainable Cities and Communities", color: "#FD9D24" },
  { number: 12, name: "Responsible Consumption and Production", color: "#BF8B2E" },
  { number: 13, name: "Climate Action", color: "#3F7E44" },
  { number: 14, name: "Life Below Water", color: "#0A97D9" },
  { number: 15, name: "Life on Land", color: "#56C02B" },
  { number: 16, name: "Peace, Justice and Strong Institutions", color: "#00689D" },
  { number: 17, name: "Partnerships for the Goals", color: "#19486A" },
];

export default function HomeClient({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL search params
  const activeCategory = searchParams.get("category") || "";
  const activeSdg = searchParams.get("sdg") || "";
  const activeTopic = searchParams.get("topic") || "";
  const activeMea = searchParams.get("mea") || "";

  // Update URL search parameters smoothly
  const updateParams = (newParams: Record<string, string>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    });

    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`/${query}`, { scroll: false });
  };

  // 1. Filter Logic (AND logic)
  const filteredCourses = courses.filter((course) => {
    // Category match
    if (activeCategory && course.category !== activeCategory) {
      return false;
    }
    // SDG match
    if (activeSdg && !course.sdgGoals.includes(Number(activeSdg))) {
      return false;
    }
    // Topic match
    if (activeTopic && !course.topics.includes(activeTopic as any)) {
      return false;
    }
    // MEA match
    if (activeMea) {
      if (activeMea === "CBD") {
        const match = course.mea.some(
          (m) => m.includes("CBD") || m.includes("Nagoya") || m.includes("Cartagena")
        );
        if (!match) return false;
      } else if (activeMea === "UNFCCC") {
        const match = course.mea.some((m) => m.includes("UNFCCC") || m.includes("Paris"));
        if (!match) return false;
      } else if (activeMea === "BRS") {
        const match = course.mea.some(
          (m) => m.includes("Basel") || m.includes("Rotterdam") || m.includes("Stockholm")
        );
        if (!match) return false;
      }
    }
    return true;
  });

  // Filter out categories that don't have matching courses or are filtered out
  const displayCategories = categories.filter((cat) => {
    if (activeCategory && cat.id !== activeCategory) {
      return false;
    }
    return filteredCourses.some((course) => course.category === cat.id);
  });

  const clearAllFilters = () => {
    router.push("/");
  };

  return (
    <div>
      {/* Premium Hero section */}
      <section className="bg-sand relative overflow-hidden py-14 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-black uppercase tracking-wider text-forest">
              United Nations Information Portal on Multilateral Environmental Agreements
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
              Free, self-paced environmental law courses
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-700">
              Browse a course catalog inspired by InforMEA eLearning, featuring SDG goals tracking, MEA thematic paths, and professional certifications.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#catalog"
                className="rounded-md bg-forest px-5 py-3 text-sm font-black text-white hover:bg-emerald-800 transition-colors shadow-sm"
              >
                Browse catalog
              </a>
              <Link
                href="/auth/signup"
                className="rounded-md bg-white px-5 py-3 text-sm font-black text-forest ring-1 ring-emerald-200 hover:bg-emerald-50 transition-colors shadow-sm"
              >
                Create free account
              </Link>
            </div>
          </div>
          <div className="hidden lg:block rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 relative">
            <div className="grid grid-cols-2 gap-4 h-full align-middle justify-center">
              {[
                ["30+", "catalog entries"],
                ["6", "thematic areas"],
                ["17", "SDG goal filters"],
                ["100%", "self-paced"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-6 flex flex-col justify-center">
                  <p className="text-3xl font-black text-ocean">{value}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500 uppercase tracking-wide">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Course Catalog Section */}
      <section id="catalog" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-black tracking-tight text-slate-950">Explore Course Catalog</h2>
        <p className="mt-2 text-slate-600">Filter courses by theme, SDG target, topic, or specific MEA convention.</p>

        {/* Unified Filter Controls Panel */}
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-6">
          
          {/* 1. Category Tabs */}
          <div>
            <span className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Filter by Thematic Area
            </span>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              <button
                onClick={() => updateParams({ category: "" })}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition-all duration-200 ${
                  !activeCategory
                    ? "bg-forest text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                All Categories
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => updateParams({ category: category.id })}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition-all duration-200 ${
                    activeCategory === category.id
                      ? "bg-forest text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. SDG Goal Filter */}
          <div>
            <span className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Filter by Sustainable Development Goal (SDG)
            </span>
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-thin">
              <button
                onClick={() => updateParams({ sdg: "" })}
                aria-label="All SDG Goals"
                className={`flex-shrink-0 flex flex-col items-center justify-center h-12 w-12 rounded-lg border transition-all duration-200 ${
                  !activeSdg
                    ? "border-forest bg-emerald-50 text-forest ring-1 ring-forest"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="text-xs font-black leading-tight text-center">ALL</span>
                <span className="text-[8px] font-bold uppercase tracking-tighter">Goals</span>
              </button>
              {sdgGoals.map((goal) => {
                const isSelected = activeSdg === String(goal.number);
                return (
                  <button
                    key={goal.number}
                    onClick={() => updateParams({ sdg: String(goal.number) })}
                    title={`Goal ${goal.number}: ${goal.name}`}
                    aria-label={`Goal ${goal.number}: ${goal.name}`}
                    style={{ backgroundColor: goal.color }}
                    className={`flex-shrink-0 relative flex items-center justify-center h-12 w-12 rounded-lg font-black text-white text-base shadow-sm hover:scale-105 transition-all duration-150 ${
                      isSelected
                        ? "ring-4 ring-forest ring-offset-2 scale-105 z-10"
                        : "opacity-85 hover:opacity-100"
                    }`}
                  >
                    {goal.number}
                    {isSelected && (
                      <span className="absolute -top-1.5 -right-1.5 bg-forest text-white h-4.5 w-4.5 rounded-full text-[9px] font-black border border-white flex items-center justify-center">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 & 4. Dropdowns Section */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100">
            {/* Topic Filter */}
            <label className="block text-sm font-bold text-slate-700">
              Filter by Topic
              <select
                value={activeTopic}
                onChange={(e) => updateParams({ topic: e.target.value })}
                className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-forest focus:outline-none focus:ring-1 focus:ring-forest cursor-pointer"
              >
                <option value="">All Topics</option>
                <option value="mea-introductory">MEA Introductory</option>
                <option value="human-rights">Human Rights</option>
                <option value="gender">Gender</option>
              </select>
            </label>

            {/* MEA Dropdown */}
            <label className="block text-sm font-bold text-slate-700">
              Visit MEA dedicated section:
              <select
                value={activeMea}
                onChange={(e) => updateParams({ mea: e.target.value })}
                className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-forest focus:outline-none focus:ring-1 focus:ring-forest cursor-pointer"
              >
                <option value="">Select MEA</option>
                <option value="CBD">Convention on Biological Diversity (CBD)</option>
                <option value="UNFCCC">United Nations Framework Convention on Climate Change (UNFCCC)</option>
                <option value="BRS">Basel, Rotterdam, and Stockholm Conventions (BRS)</option>
              </select>
            </label>
          </div>
        </div>

        {/* Filter Count & Clear */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-base text-slate-800">
            Showing <span className="font-black text-forest">{filteredCourses.length}</span>{" "}
            {filteredCourses.length === 1 ? "course" : "courses"}
          </p>
          {(activeCategory || activeSdg || activeTopic || activeMea) && (
            <button
              onClick={clearAllFilters}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Grouped Course List */}
        {filteredCourses.length === 0 ? (
          <div className="mt-16 text-center py-12 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-4xl">🍃</span>
            <h3 className="mt-3 text-lg font-bold text-slate-800">No courses match your filters</h3>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your thematic, SDG, topic, or MEA controls.
            </p>
            <button
              onClick={clearAllFilters}
              className="mt-4 rounded-md bg-forest px-4 py-2 text-sm font-black text-white hover:bg-emerald-800 transition-colors"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="space-y-12 mt-4">
            {displayCategories.map((category) => {
              const categoryCourses = filteredCourses.filter(
                (course) => course.category === category.id
              );
              
              const regularCourses = categoryCourses.filter(
                (course) => !course.isDiploma && !course.isExternal
              );
              const diplomaCourses = categoryCourses.filter((course) => course.isDiploma);
              const externalCourses = categoryCourses.filter((course) => course.isExternal);

              return (
                <div key={category.id} className="pt-6">
                  {/* Category Header */}
                  <h3 className="text-2xl font-black text-slate-900 border-b border-slate-200 pb-2 mb-6 tracking-tight">
                    {category.label}
                  </h3>

                  {/* Regular Courses Grid */}
                  {regularCourses.length > 0 && (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {regularCourses.map((course) => (
                        <CourseCard key={course.id} course={course} />
                      ))}
                    </div>
                  )}

                  {/* Diploma Courses Grid (Special Display) */}
                  {diplomaCourses.length > 0 && (
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {diplomaCourses.map((course) => (
                        <article
                          key={course.id}
                          className="flex h-full flex-col rounded-xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ring-1 ring-amber-100"
                        >
                          <div className="flex items-start justify-between">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800 border border-amber-200 shadow-sm animate-pulse">
                              Specialist Diploma
                            </span>
                            <span className="text-base">🎓</span>
                          </div>

                          <h4 className="mt-4 text-lg font-black leading-snug text-slate-950">
                            {course.title}
                          </h4>
                          <p className="mt-3 flex-grow text-sm leading-relaxed text-slate-700">
                            {course.description ||
                              "Obtain a specialist certification pathway validating your environmental law and multilateral agreements research expertise."}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {course.sdgGoals.map((goal) => (
                              <span
                                key={goal}
                                className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"
                              >
                                SDG {goal}
                              </span>
                            ))}
                          </div>

                          <div className="mt-6 flex items-center gap-2 text-sm font-bold w-full">
                            <Link
                               href={`/courses/${course.id}`}
                              className="flex-1 text-center rounded-md bg-amber-600 px-3 py-2 text-white hover:bg-amber-700 transition-colors shadow-sm"
                            >
                              Get Diploma
                            </Link>
                            {course.syllabusUrl && (
                              <a
                                href={course.syllabusUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-center rounded-md border border-amber-300 bg-white px-3 py-2 text-amber-700 hover:border-amber-600 hover:text-amber-600 transition-colors shadow-sm"
                              >
                                Syllabus
                              </a>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {/* External Related Courses subsection */}
                  {externalCourses.length > 0 && (
                    <div className="mt-6 rounded-xl bg-slate-50 p-6 border border-slate-200">
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                        <span>🌐</span> External related courses
                      </h4>
                      <div className="grid gap-3">
                        {externalCourses.map((course) => (
                          <a
                            key={course.id}
                            href={course.externalUrl || course.courseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-bold text-forest hover:text-emerald-800 hover:underline"
                          >
                            <span>→</span> {course.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
