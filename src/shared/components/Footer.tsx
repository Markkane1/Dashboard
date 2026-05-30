import React from "react";
import { Link } from "@/shared/navigation";

const organizations = [
  { name: "UN", href: "https://www.un.org" },
  { name: "UNEP", href: "https://www.unep.org" },
  { name: "FAO", href: "https://www.fao.org" },
  { name: "UNESCO", href: "https://www.unesco.org" },
  { name: "UNECE", href: "https://unece.org" },
  { name: "ECOLEX", href: "https://www.ecolex.org" },
  { name: "UNITAR", href: "https://unitar.org" },
  { name: "European Union", href: "https://ec.europa.eu" },
];

const treaties = [
  { name: "UNFCCC", href: "https://unfccc.int" },
  { name: "UNCCD", href: "https://www.unccd.int" },
  { name: "OZONE", href: "https://ozone.unep.org" },
  { name: "BASEL", href: "http://www.basel.int" },
  { name: "ROTTERDAM", href: "http://www.pic.int" },
  { name: "STOCKHOLM", href: "http://chm.pops.int" },
  { name: "CBD", href: "https://www.cbd.int" },
  { name: "CITES", href: "https://cites.org" },
  { name: "Ramsar", href: "https://www.ramsar.org" },
  { name: "Minamata Convention", href: "https://www.minamataconvention.org" },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Main 3-column Footer Grid */}
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          
          {/* Column 1: App Info (Sleek Branding) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-forest text-xs font-black text-white">
                EPA
              </span>
              <span className="text-lg font-black tracking-tight text-white">
                EPA Elearning Platform
              </span>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              An interactive e-learning platform clone inspired by the United Nations Information Portal on Multilateral Environmental Agreements (InforMEA). Providing self-paced training resources to expand legal and environmental literacy globally.
            </p>
          </div>

          {/* Column 2: Organizations */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400">
              Organizations
            </h3>
            <ul className="mt-4 grid grid-cols-1 gap-2 text-sm">
              {organizations.map((org) => (
                <li key={org.name}>
                  <a
                    href={org.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors duration-200 flex items-center gap-1 group"
                  >
                    <span>{org.name}</span>
                    <span className="text-[10px] text-slate-600 group-hover:text-emerald-400 transition-colors">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Global Treaties */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400">
              Global treaties
            </h3>
            <ul className="mt-4 grid grid-cols-1 gap-2 text-sm">
              {treaties.map((treaty) => (
                <li key={treaty.name}>
                  <a
                    href={treaty.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors duration-200 flex items-center gap-1 group"
                  >
                    <span>{treaty.name}</span>
                    <span className="text-[10px] text-slate-600 group-hover:text-emerald-400 transition-colors">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Divider line */}
        <div className="mt-12 border-t border-slate-800 pt-8" />

        {/* Bottom Section: Copyrights & Data Retention */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs">
          <p className="leading-relaxed max-w-2xl">
            Terms and conditions — Portions Copyright © United Nations, FAO, UNEP, UNESCO
          </p>
          <div className="flex-shrink-0">
            <Link
              href="/data-retention"
              className="font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition-all duration-200"
            >
              Data retention summary
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
