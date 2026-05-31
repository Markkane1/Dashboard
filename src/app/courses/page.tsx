import CategoryTabs from "@/features/courses/components/CategoryTabs";
import CourseInfiniteGrid from "@/features/courses/components/CourseInfiniteGrid";
import MEADropdown from "@/shared/components/MEADropdown";
import SDGFilter from "@/features/courses/components/SDGFilter";
import TopicFilter from "@/features/courses/components/TopicFilter";
import { CoursePageParams, fetchCoursePage } from "@/infrastructure/api/courses";
import { fetchTaxonomies } from "@/infrastructure/api/taxonomies";

type CoursesPageProps = {
  searchParams: {
    category?: string;
    sdg?: string;
    section?: string;
    mea?: string;
    topic?: string;
    q?: string;
  };
};

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const activeGoal = searchParams.sdg ? Number(searchParams.sdg) : undefined;
  const activeSection = searchParams.section || searchParams.mea;
  const filters: CoursePageParams = {
    limit: 24,
    category: searchParams.category,
    sdg: searchParams.sdg,
    section: activeSection,
    topic: searchParams.topic,
    q: searchParams.q,
  };

  const [coursePage, categories, topics, sections, sdgItems] = await Promise.all([
    fetchCoursePage(filters),
    fetchTaxonomies('category'),
    fetchTaxonomies('topic'),
    fetchTaxonomies('section'),
    fetchTaxonomies('sdg'),
  ]);

  const activeParams = {
    category: searchParams.category,
    sdg: searchParams.sdg,
    section: activeSection,
    topic: searchParams.topic,
    q: searchParams.q,
  };
  const categoryOptions = categories.length
    ? categories.map((item) => ({ id: item.key, label: item.label }))
    : [];
  const topicOptions = topics.length ? topics.map((item) => ({ key: item.key, label: item.label })) : [];
  const sectionOptions = sections.length ? sections.map((item) => ({ key: item.key, label: item.label })) : [];
  const sdgGoals = sdgItems.length
    ? sdgItems
        .map((item) => Number(item.key))
        .filter((goal) => Number.isInteger(goal))
        .sort((a, b) => a - b)
    : [1, 2, 3, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-forest">Course catalog</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">All environmental courses</h1>
        </div>
        <form className="flex w-full flex-col gap-2 sm:flex-row md:max-w-md">
          {searchParams.category && <input type="hidden" name="category" value={searchParams.category} />}
          {searchParams.sdg && <input type="hidden" name="sdg" value={searchParams.sdg} />}
          {activeSection && <input type="hidden" name="section" value={activeSection} />}
          {searchParams.topic && <input type="hidden" name="topic" value={searchParams.topic} />}
          <input
            name="q"
            defaultValue={searchParams.q || ""}
            placeholder="Search courses"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-forest px-4 py-2 text-sm font-bold text-white">Search</button>
        </form>
      </div>

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <SDGFilter activeGoal={activeGoal} goals={sdgGoals} searchParams={activeParams} />
          <MEADropdown activeSection={activeSection} sections={sectionOptions} />
          {topicOptions.length > 0 ? (
            <TopicFilter topics={topicOptions} activeTopic={searchParams.topic} searchParams={activeParams} />
          ) : (
            <TopicFilter topics={["mea-introductory", "human-rights", "gender"]} activeTopic={searchParams.topic} searchParams={activeParams} />
          )}
        </aside>

        <section className="min-w-0">
          <CategoryTabs categories={categoryOptions} activeCategory={searchParams.category} searchParams={activeParams} />
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
