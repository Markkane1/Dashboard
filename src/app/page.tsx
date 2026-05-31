import React, { Suspense } from "react";
import HomeClient from "@/features/courses/components/HomeClient";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "InforMEA Learning",
    description: "United Nations Information Portal on Multilateral Environmental Agreements",
    openGraph: {
      title: "InforMEA Learning",
      description: "United Nations Information Portal on Multilateral Environmental Agreements",
      type: "website",
      url: "https://elearning.informea.org/",
      siteName: "InforMEA Learning",
    },
    twitter: {
      card: "summary_large_image",
      title: "InforMEA Learning",
      description: "United Nations Information Portal on Multilateral Environmental Agreements",
    },
  };
}

import { fetchCoursePage } from "@/infrastructure/api/courses";

export default async function HomePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters = {
    category: typeof searchParams.category === 'string' ? searchParams.category : undefined,
    sdg: typeof searchParams.sdg === 'string' ? searchParams.sdg : undefined,
    topic: typeof searchParams.topic === 'string' ? searchParams.topic : undefined,
    mea: typeof searchParams.mea === 'string' ? searchParams.mea : undefined,
    q: typeof searchParams.q === 'string' ? searchParams.q : undefined,
    limit: 60,
  };
  const coursePage = await fetchCoursePage(filters);
  const courses = coursePage.courses;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-forest" />
        </div>
      }
    >
      <HomeClient courses={courses} />
    </Suspense>
  );
}
