import React, { Suspense } from "react";
import HomeClient from "@/features/courses/components/HomeClient";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "EPA Elearning",
    description: "Environmental learning and training for multilateral environmental agreements",
    openGraph: {
      title: "EPA Elearning",
      description: "Environmental learning and training for multilateral environmental agreements",
      type: "website",
      url: "https://elearning.example.com/",
      siteName: "EPA Elearning",
    },
    twitter: {
      card: "summary_large_image",
      title: "EPA Elearning",
      description: "Environmental learning and training for multilateral environmental agreements",
    },
  };
}

import { fetchCoursePage } from "@/infrastructure/api/courses";
import { fetchTaxonomies } from "@/infrastructure/api/taxonomies";

export default async function HomePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const activeSection = typeof searchParams.section === 'string'
    ? searchParams.section
    : typeof searchParams.mea === 'string'
      ? searchParams.mea
      : undefined;
  const filters = {
    category: typeof searchParams.category === 'string' ? searchParams.category : undefined,
    sdg: typeof searchParams.sdg === 'string' ? searchParams.sdg : undefined,
    topic: typeof searchParams.topic === 'string' ? searchParams.topic : undefined,
    section: activeSection,
    q: typeof searchParams.q === 'string' ? searchParams.q : undefined,
    limit: 24,
  };
  const [coursePage, taxonomyCategories, taxonomyTopics, taxonomySections, taxonomySdgs] = await Promise.all([
    fetchCoursePage(filters),
    fetchTaxonomies("category").catch(() => []),
    fetchTaxonomies("topic").catch(() => []),
    fetchTaxonomies("section").catch(() => []),
    fetchTaxonomies("sdg").catch(() => []),
  ]);
  const courses = coursePage.courses;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-forest" />
        </div>
      }
    >
      <HomeClient
        courses={courses}
        categories={taxonomyCategories.map((item) => ({ id: item.key, label: item.label }))}
        topics={taxonomyTopics.map((item) => ({ key: item.key, label: item.label }))}
        sections={taxonomySections.map((item) => ({ key: item.key, label: item.label }))}
        sdgGoals={taxonomySdgs.map((item) => Number(item.key)).filter((goal) => Number.isInteger(goal))}
      />
    </Suspense>
  );
}
