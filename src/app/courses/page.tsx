import CategoryTabs from "@/features/courses/components/CategoryTabs";
import CourseInfiniteGrid from "@/features/courses/components/CourseInfiniteGrid";
import MEADropdown from "@/shared/components/MEADropdown";
import SDGFilter from "@/features/courses/components/SDGFilter";
import { Category } from "@/shared/types";
import { CoursePageParams, fetchCoursePage } from "@/infrastructure/api/courses";

type CoursesPageProps = {
  searchParams: {
    category?: Category;
    sdg?: string;
    topic?: string;
    mea?: string;
    q?: string;
  };
};

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const activeGoal = searchParams.sdg ? Number(searchParams.sdg) : undefined;
  const filters: CoursePageParams = {
    limit: 24,
    category: searchParams.category,
    sdg: searchParams.sdg,
    topic: searchParams.topic,
    mea: searchParams.mea,
    q: searchParams.q,
  };
  const coursePage = await fetchCoursePage(filters);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-forest">Course catalog</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">All InforMEA-style courses</h1>
        </div>
        <form className="flex w-full gap-2 md:max-w-md">
          <input
            name="q"
            defaultValue={searchParams.q || ""}
            placeholder="Search courses"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-forest px-4 py-2 text-sm font-bold text-white">Search</button>
        </form>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-5">
          <SDGFilter activeGoal={activeGoal} />
          <MEADropdown activeMea={searchParams.mea} />
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Topics</h2>
            <div className="mt-3 grid gap-2 text-sm font-bold">
              <a href="/courses?topic=mea-introductory" className="rounded-md bg-slate-100 px-3 py-2 text-slate-700">MEA Introductory</a>
              <a href="/courses?topic=human-rights" className="rounded-md bg-slate-100 px-3 py-2 text-slate-700">Human Rights</a>
              <a href="/courses?topic=gender" className="rounded-md bg-slate-100 px-3 py-2 text-slate-700">Gender</a>
            </div>
          </div>
        </aside>

        <section>
          <CategoryTabs activeCategory={searchParams.category} />
          <CourseInfiniteGrid
            initialCourses={coursePage.courses}
            initialNextCursor={coursePage.nextCursor}
            totalCount={coursePage.totalCount}
            filters={filters}
          />
        </section>
      </div>
    </div>
  );
}
