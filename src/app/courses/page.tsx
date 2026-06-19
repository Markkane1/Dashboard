import CourseInfiniteGrid from "@/features/courses/components/CourseInfiniteGrid";
import { CoursePageParams, fetchCoursePage } from "@/infrastructure/api/courses";
import { fetchTaxonomies } from "@/infrastructure/api/taxonomies";
import { Link } from "@/shared/navigation";
import {
  DashboardCard,
  FilterBar,
  PageHeader,
  PageShell,
} from "@/shared/components/ui/DesignSystem";

type CoursesPageProps = {
  searchParams: Promise<{
    category?: string;
    sdg?: string;
    section?: string;
    mea?: string;
    topic?: string;
    q?: string;
  }>;
};

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeSection = resolvedSearchParams.section || resolvedSearchParams.mea;
  const filters: CoursePageParams = {
    limit: 24,
    category: resolvedSearchParams.category,
    sdg: resolvedSearchParams.sdg,
    section: activeSection,
    topic: resolvedSearchParams.topic,
    q: resolvedSearchParams.q,
  };

  const [coursePage, categories, topics, sections, sdgItems] = await Promise.all([
    fetchCoursePage(filters),
    fetchTaxonomies("category"),
    fetchTaxonomies("topic"),
    fetchTaxonomies("section"),
    fetchTaxonomies("sdg"),
  ]);

  const categoryOptions = categories.map((item) => ({ id: item.key, label: item.label }));
  const topicOptions = topics.map((item) => ({ key: item.key, label: item.label }));
  const sectionOptions = sections.map((item) => ({ key: item.key, label: item.label }));
  const sdgGoals = sdgItems.length
    ? sdgItems
        .map((item) => Number(item.key))
        .filter((goal) => Number.isInteger(goal))
        .sort((a, b) => a - b)
    : [1, 2, 3, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17];
  const activeFilterCount = [
    resolvedSearchParams.category,
    resolvedSearchParams.sdg,
    activeSection,
    resolvedSearchParams.topic,
    resolvedSearchParams.q,
  ].filter(Boolean).length;

  return (
    <PageShell>
      <PageHeader
        title="All courses"
        description="Search, filter, and open course details from one list."
        actions={(
          <Link href="/" className="btn-secondary">
            Home
          </Link>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
        <DashboardCard className="p-6">
          <div className="grid gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[#4e73df]">Catalog total</p>
            <p className="text-3xl font-bold text-[#5a5c69]">{coursePage.totalCount}</p>
            <p className="text-sm text-[#858796]">Courses matching current filters</p>
          </div>
        </DashboardCard>

        <DashboardCard className="p-6">
          <div className="grid gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[#1cc88a]">Active filters</p>
            <p className="text-3xl font-bold text-[#5a5c69]">{activeFilterCount}</p>
            <p className="text-sm text-[#858796]">Reset or refine your search</p>
          </div>
        </DashboardCard>
      </div>

      <section className="mt-6">
        <form className="space-y-4">
          <FilterBar>
            <div className="filter-bar-group">
              <input
                name="q"
                defaultValue={resolvedSearchParams.q || ""}
                placeholder="Search courses"
                className="control min-w-[16rem]"
              />
              <select name="category" defaultValue={resolvedSearchParams.category || ""} className="control min-w-[12rem]">
                <option value="">All themes</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
              <select name="sdg" defaultValue={resolvedSearchParams.sdg || ""} className="control min-w-[12rem]">
                <option value="">All SDGs</option>
                {sdgGoals.map((goal) => (
                  <option key={goal} value={goal}>SDG {goal}</option>
                ))}
              </select>
              <select name="topic" defaultValue={resolvedSearchParams.topic || ""} className="control min-w-[12rem]">
                <option value="">All topics</option>
                {topicOptions.map((topic) => (
                  <option key={topic.key} value={topic.key}>{topic.label}</option>
                ))}
              </select>
              <select name="section" defaultValue={activeSection || ""} className="control min-w-[12rem]">
                <option value="">All sections</option>
                {sectionOptions.map((section) => (
                  <option key={section.key} value={section.key}>{section.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button type="submit" className="bg-[#4e73df] hover:bg-[#2e59d9] text-white font-bold py-2 px-4 rounded transition-colors text-sm">Apply</button>
              <Link href="/courses" className="bg-white border border-[#e3e6f0] hover:bg-[#f8f9fc] text-[#5a5c69] font-bold py-2 px-4 rounded transition-colors text-sm">Clear filters</Link>
            </div>
          </FilterBar>
        </form>
      </section>

      <section className="mt-6">
        <CourseInfiniteGrid
          initialCourses={coursePage.courses}
          initialNextCursor={coursePage.nextCursor}
          totalCount={coursePage.totalCount}
          filters={filters}
        />
      </section>
    </PageShell>
  );
}
