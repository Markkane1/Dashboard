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
          <div className="grid gap-3">
            <p className="text-sm font-semibold text-text-muted">Catalog total</p>
            <p className="text-3xl font-black text-text-primary">{coursePage.totalCount}</p>
            <p className="text-sm text-text-muted">Courses matching current filters</p>
          </div>
        </DashboardCard>

        <DashboardCard className="p-6">
          <div className="grid gap-3">
            <p className="text-sm font-semibold text-text-muted">Active filters</p>
            <p className="text-3xl font-black text-text-primary">{activeFilterCount}</p>
            <p className="text-sm text-text-muted">Reset or refine your search</p>
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
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary">Apply</button>
              <Link href="/courses" className="btn-secondary">Clear filters</Link>
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
