"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CourseCard from "./CourseCard";
import { categories as fallbackCategories } from "../data/categories";
import { Link } from "@/shared/navigation";
import { Course } from "@/shared/types";
import {
  DashboardCard,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
} from "@/shared/components/ui/DesignSystem";

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
  sdgGoals,
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
  const visibleSdgGoals = sdgGoals?.length ? sdgGoals : [1, 2, 3, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17];

  const activeCategory = searchParams.get("category") || "";
  const activeSdg = searchParams.get("sdg") || "";
  const activeTopic = searchParams.get("topic") || "";
  const activeSection = searchParams.get("section") || searchParams.get("mea") || "";
  const activeSearch = searchParams.get("q") || "";

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

    const query = current.toString();
    router.push(query ? `/?${query}` : "/", { scroll: false });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateParams({
      q: String(formData.get("q") || ""),
      category: String(formData.get("category") || ""),
      sdg: String(formData.get("sdg") || ""),
      topic: String(formData.get("topic") || ""),
      section: String(formData.get("section") || ""),
    });
  };

  const clearAllFilters = () => router.push("/");
  const activeFilterCount = [activeCategory, activeSdg, activeTopic, activeSection, activeSearch].filter(Boolean).length;
  const regularCourses = courses.filter((course) => !course.isDiploma && !course.isExternal);
  const diplomaCourses = courses.filter((course) => course.isDiploma);
  const externalCourses = courses.filter((course) => course.isExternal);

  return (
    <PageShell>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <PageHeader
            title="Environmental courses"
            description="Browse self-paced courses by theme, SDG, topic, or treaty section."
            actions={(
              <Link href="/courses" className="btn-secondary">
                Open full catalog
              </Link>
            )}
          />
        </div>

        <DashboardCard className="p-6">
          <div className="grid gap-4">
            <div>
              <p className="text-sm font-semibold text-text-muted">Catalog overview</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [courses.length, "Courses"],
                [categoryOptions.length, "Themes"],
                [visibleSdgGoals.length, "SDGs"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-surface p-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-text-primary">{value}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.24em] text-text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </DashboardCard>
      </div>

      <section className="mt-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FilterBar>
            <div className="filter-bar-group">
              <input name="q" defaultValue={activeSearch} placeholder="Search courses" className="control min-w-[14rem]" />
              <select name="category" defaultValue={activeCategory} className="control min-w-[14rem]">
                <option value="">All themes</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
              <select name="sdg" defaultValue={activeSdg} className="control min-w-[12rem]">
                <option value="">All SDGs</option>
                {visibleSdgGoals.map((goal) => (
                  <option key={goal} value={goal}>SDG {goal}</option>
                ))}
              </select>
              <select name="topic" defaultValue={activeTopic} className="control min-w-[12rem]">
                <option value="">All topics</option>
                {topicOptions.map((topic) => (
                  <option key={topic.key} value={topic.key}>{topic.label}</option>
                ))}
              </select>
              <select name="section" defaultValue={activeSection} className="control min-w-[12rem]">
                <option value="">All sections</option>
                {sectionOptions.map((section) => (
                  <option key={section.key} value={section.key}>{section.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary">
                Apply filters
              </button>
              <button type="button" onClick={clearAllFilters} className="btn-secondary">
                Clear filters
              </button>
            </div>
          </FilterBar>
        </form>
      </section>

      {courses.length === 0 ? (
        <EmptyState
          title="No courses match your filters"
          description="Try adjusting your search or catalog filters."
          actions={(
            <button type="button" onClick={clearAllFilters} className="btn-primary">
              Reset filters
            </button>
          )}
          className="mt-6"
        />
      ) : (
        <div className="mt-8 space-y-8">
          {regularCourses.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-text-primary">Courses</h2>
                  <p className="mt-1 text-sm text-text-muted">{regularCourses.length} available</p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {regularCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </section>
          )}

          {diplomaCourses.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-text-primary">Diploma pathways</h2>
                  <p className="mt-1 text-sm text-text-muted">{diplomaCourses.length} available</p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {diplomaCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </section>
          )}

          {externalCourses.length > 0 && (
            <section>
              <DashboardCard className="p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-text-primary">External courses</h2>
                    <p className="mt-1 text-sm text-text-muted">Curated course links from trusted partners.</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  {externalCourses.map((course) => (
                    <a
                      key={course.id}
                      href={course.externalUrl || course.courseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-2xl border border-border bg-white px-4 py-4 text-sm font-semibold text-primary transition hover:bg-surface"
                    >
                      {course.title}
                    </a>
                  ))}
                </div>
              </DashboardCard>
            </section>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Link href="/courses" className="btn-secondary">
          Open full catalog
        </Link>
      </div>
    </PageShell>
  );
}
