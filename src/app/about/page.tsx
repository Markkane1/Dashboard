import React from "react";
import { Link } from "@/shared/navigation";
import { Metadata } from "next";
import { DashboardCard, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

export const metadata: Metadata = {
  title: "About Us | EPA Elearning",
  description: "About the environmental learning portal for multilateral environmental agreements.",
};

const features = [
  ["Course catalog", "Self-paced lessons across environmental agreement themes."],
  ["Certificates", "Track completion and download eligible certificates."],
  ["Role-based tools", "Instructor and admin workflows for content operations."],
];

const categories = [
  "Biological Diversity",
  "Chemicals and Waste",
  "Climate and Atmosphere",
  "Environmental Governance",
  "Land and Agriculture",
  "Marine and Freshwater",
];

const partners = ["UN", "UNEP", "FAO", "UNESCO", "UNECE", "ECOLEX", "UNITAR", "European Union"];

export default function AboutPage() {
  return (
    <PageShell>
      <PageHeader
        title="EPA Elearning"
        description="A learning portal for environmental governance education and multilateral environmental agreement training."
        actions={(
          <Link href="/courses" className="btn-primary">
            Browse courses
          </Link>
        )}
      />

      <section className="grid gap-4 md:grid-cols-3">
        {features.map(([title, description]) => (
          <DashboardCard key={title} className="p-4">
            <h2 className="text-base font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{description}</p>
          </DashboardCard>
        ))}
      </section>

      <DashboardCard className="mt-5 p-6">
        <h2 className="text-lg font-black text-slate-950">Course themes</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div key={category} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
              {category}
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="mt-5 p-6">
        <h2 className="text-lg font-black text-slate-950">Partner organizations</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {partners.map((partner) => (
            <span key={partner} className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
              {partner}
            </span>
          ))}
        </div>
      </DashboardCard>
    </PageShell>
  );
}
