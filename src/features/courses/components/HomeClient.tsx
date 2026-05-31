"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CourseCard from "./CourseCard";
import { categories as fallbackCategories } from "../data/categories";
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

type TaxonomyOption = {
  key: string;
  label: string;
};

type CategoryOption = {
  id: string;
  label: string;
};

export default function HomeClient({
  courses,
  categories,
  topics,
  sections,
  sdgGoals: taxonomySdgGoals,
}: {
  courses: Course[];
  categories?: CategoryOption[];
  topics?: TaxonomyOption[];
  sections?: TaxonomyOption[];
  sdgGoals?: number[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryOptions = categories?.length ? categories : fallbackCategories;
  const topicOptions = topics?.length
    ? topics
    : [
        { key: "mea-introductory", label: "MEA Introductory" },
        { key: "human-rights", label: "Human Rights" },
        { key: "gender", label: "Gender" },
      ];
  const sectionOptions = sections?.length
    ? sections
    : [
        { key: "CBD", label: "Convention on Biological Diversity (CBD)" },
        { key: "UNFCCC", label: "United Nations Framework Convention on Climate Change (UNFCCC)" },
        { key: "BRS", label: "Basel, Rotterdam, and Stockholm Conventions (BRS)" },
      ];
  const visibleSdgGoals = taxonomySdgGoals?.length
    ? taxonomySdgGoals
    : sdgGoals.map((goal) => goal.number);

  // Read URL search params
  const activeCategory = searchParams.get("category") || "";
  const activeSdg = searchParams.get("sdg") || "";
  const activeTopic = searchParams.get("topic") || "";
  const activeSection = searchParams.get("section") || searchParams.get("mea") || "";
  const activeSearch = searchParams.get("q") || "";

  // Update URL search parameters smoothly
  const updateParams = (newParams: Record<string, string>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.delete("cursor");

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

  const filteredCourses = courses;

  // Filter out categories that don't have matching courses
  const displayCategories = categoryOptions.filter((cat) => {
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
      <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="max-w-3xl text-xs font-black uppercase tracking-[0.18em] text-forest sm:text-sm">
              United Nations Information Portal on Multilateral Environmental Agreements
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.06] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl font-sora">
              Free, self-paced environmental law courses
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Browse a course catalog with SDG goals tracking, MEA thematic paths, and professional certifications.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#catalog"
                className="inline-flex justify-center items-center rounded-full bg-forest px-6 py-3 text-sm font-black text-white shadow-lg shadow-forest/10 transition-all duration-300 hover:bg-[#b0f0d6] hover:text-[#003527] hover:scale-[1.02]"
              >
                Browse catalog
              </a>
              <Link
                href="/auth/signup"
                className="inline-flex justify-center items-center rounded-full bg-white/70 backdrop-blur-sm px-6 py-3 text-sm font-black text-forest shadow-sm ring-1 ring-emerald-250/30 transition-all duration-300 hover:bg-[#b0f0d6] hover:text-[#003527] hover:scale-[1.02]"
              >
                Create free account
              </Link>
            </div>
          </div>
          <div className="glass-card p-5 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4">
              {[
                ["30+", "catalog entries"],
                ["6", "thematic areas"],
                ["17", "SDG goal filters"],
                ["100%", "self-paced"],
              ].map(([value, label]) => (
                <div key={label} className="min-h-28 rounded-2xl bg-white/40 border border-white/20 p-4 sm:p-5 hover:scale-[1.02] transition-transform duration-200">
                  <p className="text-3xl font-black tracking-tight text-forest">{value}</p>
                  <p className="mt-2 text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Course Catalog Section */}
      <section id="catalog" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <h2 className="text-3xl font-black tracking-tight text-slate-950 font-sora">Explore courses</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Filter by theme, SDG target, topic, or treaty section.</p>

        <form className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row">
          {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
          {activeSdg && <input type="hidden" name="sdg" value={activeSdg} />}
          {activeTopic && <input type="hidden" name="topic" value={activeTopic} />}
          {activeSection && <input type="hidden" name="section" value={activeSection} />}
          <input
            name="q"
            defaultValue={activeSearch}
            placeholder="Search courses, treaties, topics"
            className="control min-w-0 flex-1"
          />
          <button className="rounded-full bg-forest px-6 py-2.5 text-sm font-black text-white hover:bg-[#b0f0d6] hover:text-[#003527] transition-all">
            Search
          </button>
        </form>

        {/* Unified Filter Controls Panel */}
        <div className="mt-8 space-y-6 glass-card p-5 sm:p-8">
          
          {/* 1. Category Tabs */}
          <div>
            <span className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Filter by Thematic Area
            </span>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                type="button"
                onClick={() => updateParams({ category: "" })}
                className={`whitespace-nowrap rounded-full px-5 py-2.5 text-xs font-black transition-all duration-200 ${
                  !activeCategory
                    ? "bg-forest text-white shadow-md shadow-forest/10"
                    : "bg-white/40 text-slate-700 hover:bg-white/70 border border-white/20"
                }`}
              >
                All Categories
              </button>
              {categoryOptions.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => updateParams({ category: category.id })}
                  className={`whitespace-nowrap rounded-full px-5 py-2.5 text-xs font-black transition-all duration-200 ${
                    activeCategory === category.id
                      ? "bg-forest text-white shadow-md shadow-forest/10"
                      : "bg-white/40 text-slate-700 hover:bg-white/70 border border-white/20"
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
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
              <button
                type="button"
                onClick={() => updateParams({ sdg: "" })}
                aria-label="All SDG Goals"
                className={`flex-shrink-0 flex flex-col items-center justify-center h-12 w-12 rounded-xl border transition-all duration-200 ${
                  !activeSdg
                    ? "border-forest bg-forest text-white shadow-md shadow-forest/10"
                    : "border-white/20 bg-white/40 text-slate-600 hover:bg-white/75"
                }`}
              >
                <span className="text-xs font-black leading-tight text-center">ALL</span>
                <span className="text-[8px] font-bold uppercase tracking-tighter">Goals</span>
              </button>
              {visibleSdgGoals.map((goalNumber) => {
                const goal = sdgGoals.find((item) => item.number === goalNumber) || {
                  number: goalNumber,
                  name: `SDG ${goalNumber}`,
                  color: "#64748b",
                };
                const isSelected = activeSdg === String(goal.number);
                return (
                  <button
                    key={goal.number}
                    type="button"
                    onClick={() => updateParams({ sdg: String(goal.number) })}
                    title={`Goal ${goal.number}: ${goal.name}`}
                    aria-label={`Goal ${goal.number}: ${goal.name}`}
                    style={{ backgroundColor: goal.color }}
                    className={`flex-shrink-0 relative flex items-center justify-center h-12 w-12 rounded-xl font-black text-white text-base shadow-sm hover:scale-110 transition-all duration-150 ${
                      isSelected
                        ? "ring-4 ring-[#b0f0d6] ring-offset-2 scale-110 z-10"
                        : "opacity-85 hover:opacity-100"
                    }`}
                  >
                    {goal.number}
                    {isSelected && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white bg-forest text-[9px] font-black text-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 & 4. Dropdowns Section */}
          <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-white/20">
            {/* Topic Filter */}
            <label className="block text-sm font-bold text-slate-700">
              Filter by Topic
              <select
                value={activeTopic}
                onChange={(e) => updateParams({ topic: e.target.value })}
                className="mt-2 block w-full rounded-full border border-white/20 bg-white/40 backdrop-blur-sm px-4 py-2.5 text-sm font-semibold text-slate-800 focus:border-forest focus:outline-none focus:ring-1 focus:ring-forest cursor-pointer transition-all"
              >
                <option value="">All Topics</option>
                {topicOptions.map((topic) => (
                  <option key={topic.key} value={topic.key}>{topic.label}</option>
                ))}
              </select>
            </label>

            {/* MEA Dropdown */}
            <label className="block text-sm font-bold text-slate-700">
              Filter by section
              <select
                value={activeSection}
                onChange={(e) => updateParams({ section: e.target.value, mea: "" })}
                className="mt-2 block w-full rounded-full border border-white/20 bg-white/40 backdrop-blur-sm px-4 py-2.5 text-sm font-semibold text-slate-800 focus:border-forest focus:outline-none focus:ring-1 focus:ring-forest cursor-pointer transition-all"
              >
                <option value="">All sections</option>
                {sectionOptions.map((section) => (
                  <option key={section.key} value={section.key}>{section.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Filter Count & Clear */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-semibold text-slate-700">
            Showing <span className="font-black text-forest">{filteredCourses.length}</span>{" "}
            {filteredCourses.length === 1 ? "course" : "courses"}
          </p>
          {(activeCategory || activeSdg || activeTopic || activeSection || activeSearch) && (
            <button
              onClick={clearAllFilters}
              className="rounded-full border border-slate-350 bg-white/50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-white/80 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Grouped Course List */}
        {filteredCourses.length === 0 ? (
          <div className="mt-16 text-center py-12 rounded-3xl bg-white/40 border border-white/20 backdrop-blur-sm">
            <span className="text-4xl" aria-hidden="true">No results</span>
            <h3 className="mt-3 text-lg font-bold text-slate-800 font-sora">No courses match your filters</h3>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your thematic, SDG, topic, or MEA controls.
            </p>
            <button
              onClick={clearAllFilters}
              className="mt-4 rounded-full bg-forest px-5 py-2.5 text-sm font-black text-white hover:bg-[#b0f0d6] hover:text-[#003527] transition-all"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-10">
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
                  <h3 className="text-2xl font-black text-slate-900 border-b border-white/25 pb-2 mb-6 tracking-tight font-sora">
                    {category.label}
                  </h3>

                  {/* Regular Courses Grid */}
                  {regularCourses.length > 0 && (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                          className="flex h-full flex-col glass-card p-6 border-amber-250/30 bg-amber-50/10 shadow-lg shadow-amber-500/5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="rounded-full bg-amber-500 px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-white border border-amber-400 shadow-sm animate-pulse">
                              Specialist Diploma
                            </span>
                            <span className="text-base">🎓</span>
                          </div>

                          <h4 className="mt-4 text-lg font-black leading-snug text-slate-950 font-sora">
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
                                className="rounded bg-amber-100/50 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200/30"
                              >
                                SDG {goal}
                              </span>
                            ))}
                          </div>

                          <div className="mt-6 flex w-full flex-col gap-2 text-sm font-bold min-[420px]:flex-row min-[420px]:items-center">
                            <Link
                              href={`/courses/${course.id}`}
                              className="flex-1 text-center rounded-full bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 transition-colors shadow-sm"
                            >
                              Get Diploma
                            </Link>
                            {course.syllabusUrl && (
                              <a
                                href={course.syllabusUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-center rounded-full border border-amber-300 bg-white/60 px-4 py-2 text-amber-700 hover:border-amber-600 hover:text-amber-600 transition-colors shadow-sm"
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
                    <div className="mt-6 glass-card p-6 border-white/20 bg-white/40">
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2 font-sora">
                        <span>🌐</span> External related courses
                      </h4>
                      <div className="grid gap-3">
                        {externalCourses.map((course) => (
                          <a
                            key={course.id}
                            href={course.externalUrl || course.courseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-bold text-forest hover:text-brand-secondary hover:underline transition-colors"
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
