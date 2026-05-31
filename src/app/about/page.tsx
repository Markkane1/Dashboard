import React from "react";
import { Link } from "@/shared/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | EPA Elearning",
  description: "About the environmental learning portal for multilateral environmental agreements.",
};

const features = [
  {
    title: "60+ free courses",
    description: "Access self-paced, high-quality lessons designed by experts covering a wide range of international environmental law topics.",
    icon: "📚",
  },
  {
    title: "7 languages",
    description: "Learn in your preferred language. Courses are available in English, French, Spanish, Russian, Chinese, Arabic, and Portuguese.",
    icon: "🗣️",
  },
  {
    title: "UN-certified content",
    description: "Earn official, verifiable digital certificates signed by partner international organizations upon course completion.",
    icon: "🎓",
  },
];

const partners = [
  { name: "UN", desc: "United Nations" },
  { name: "UNEP", desc: "UN Environment Programme" },
  { name: "FAO", desc: "Food and Agriculture Organization" },
  { name: "UNESCO", desc: "UN Educational, Scientific and Cultural Org." },
  { name: "UNECE", desc: "UN Economic Commission for Europe" },
  { name: "ECOLEX", desc: "The Gateway to Environmental Law" },
  { name: "UNITAR", desc: "UN Institute for Training and Research" },
  { name: "European Union", desc: "EU Environmental Portal" },
];

const categories = [
  {
    title: "Biological Diversity",
    description: "Delve into the international legal frameworks governing global ecosystems, species protection, and biosafety protocols.",
    icon: "🦋",
    bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  {
    title: "Chemicals and Waste",
    description: "Explore international conventions and waste management policies to prevent toxic chemical contamination and plastic waste.",
    icon: "🧪",
    bg: "bg-amber-50 border-amber-200 text-amber-800",
  },
  {
    title: "Climate and Atmosphere",
    description: "Understand the UNFCCC, Paris Agreement, and efforts surrounding climate adaptation and ozone layer preservation.",
    icon: "🌤️",
    bg: "bg-sky-50 border-sky-200 text-sky-800",
  },
  {
    title: "Environmental Governance",
    description: "Learn how global governance, human rights, and the rule of law intersect with national and international environmental policies.",
    icon: "⚖️",
    bg: "bg-purple-50 border-purple-200 text-purple-800",
  },
  {
    title: "Land and Agriculture",
    description: "Investigate policy responses to soil degradation, desertification prevention, and sustainable land management practices.",
    icon: "🌾",
    bg: "bg-orange-50 border-orange-200 text-orange-800",
  },
  {
    title: "Marine and Freshwater",
    description: "Deep dive into the conservation of marine environments, water safety, and transboundary watercourse treaties.",
    icon: "🌊",
    bg: "bg-cyan-50 border-cyan-200 text-cyan-800",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen py-6">
      {/* Hero section */}
      <section className="relative overflow-hidden py-16 lg:py-24 border-b border-white/25 bg-white/40 backdrop-blur-md rounded-3xl mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-widest text-forest">
            About the Learning Portal
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl font-sora">
            About EPA Elearning
          </h1>
          <p className="mt-6 mx-auto max-w-3xl text-lg sm:text-xl leading-relaxed text-slate-700 font-medium">
            This portal supports environmental governance education and capacity building for learners interested in multilateral environmental agreements.
          </p>
        </div>
      </section>

      {/* What we offer section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-slate-950 tracking-tight font-sora">What We Offer</h2>
          <p className="mt-2 text-slate-500 font-medium max-w-xl mx-auto">
            High-quality environmental training tools available to learners worldwide at zero cost.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feat) => (
            <div 
              key={feat.title}
              className="glass-card p-8 border-white/25 bg-white/50 backdrop-blur-sm flex flex-col items-center text-center hover:scale-[1.02] transition-transform duration-300"
            >
              <span className="text-4xl mb-4 bg-white/60 p-4 rounded-2xl border border-white/20 shadow-sm">{feat.icon}</span>
              <h3 className="text-xl font-black text-slate-900 font-sora">{feat.title}</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed font-semibold">
                {feat.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Our courses cover section */}
      <section className="py-16 lg:py-24 border-y border-white/25 bg-white/20 backdrop-blur-sm rounded-3xl mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-950 tracking-tight font-sora">Our Courses Cover</h2>
            <p className="mt-2 text-slate-500 font-medium max-w-xl mx-auto">
              Master the key agreements and regulations across six foundational thematic pillars.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <div 
                key={cat.title} 
                className="glass-card p-6 flex flex-col justify-between shadow-sm hover:scale-[1.02] transition-transform duration-300 border-white/20 bg-white/50 backdrop-blur-sm"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <h3 className="text-base font-black text-slate-950 font-sora">{cat.title}</h3>
                  </div>
                  <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-600">
                    {cat.description}
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <span className={`text-[10px] font-black uppercase tracking-wider rounded-full px-2.5 py-1 border ${cat.bg}`}>
                    Thematic Pillar
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner organizations section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-slate-950 tracking-tight font-sora">Partner Organizations</h2>
          <p className="mt-2 text-slate-500 font-medium max-w-xl mx-auto">
            This portal is supported by international partners and reflects global collaboration on environmental learning.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {partners.map((partner) => (
            <div 
              key={partner.name}
              className="group relative flex flex-col items-center justify-center rounded-2xl border border-white/20 bg-white/50 backdrop-blur-sm p-6 text-center hover:border-forest/50 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02]"
            >
              <span className="text-lg font-black text-forest group-hover:scale-105 transition-transform duration-200">
                {partner.name}
              </span>
              <span className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                {partner.desc}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-forest py-16 lg:py-20 text-white relative overflow-hidden rounded-[32px] mx-auto max-w-7xl my-12 border border-white/10 shadow-xl shadow-forest/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(176,240,214,0.15),transparent)]" />
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-3xl font-black sm:text-4xl tracking-tight font-sora">
            Start Learning Today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-emerald-100 leading-relaxed font-semibold">
            Gain comprehensive knowledge on environmental governance. Register a free account, complete lessons, and get certified.
          </p>
          <div className="mt-8 flex justify-center">
            <Link 
              href="/"
              className="rounded-full bg-white px-8 py-3 text-sm font-black text-forest hover:bg-[#b0f0d6] hover:text-[#003527] transition-all duration-300 shadow-sm"
            >
              Browse Available Courses
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
