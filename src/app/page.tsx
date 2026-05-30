import React, { Suspense } from "react";
import HomeClient from "@/components/HomeClient";
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

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-forest" />
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
