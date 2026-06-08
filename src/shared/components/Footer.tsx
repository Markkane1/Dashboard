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
  { name: "EU", href: "https://ec.europa.eu" },
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
  { name: "Minamata", href: "https://www.minamataconvention.org" },
];

function LinkGroup({ title, links }: { title: string; links: Array<{ name: string; href: string }> }) {
  return (
    <div className="min-w-0">
      <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-slate-600 hover:text-teal-700"
          >
            {link.name}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="mt-8 border-t border-border bg-surface">
      <div className="app-shell py-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-teal-700 text-[10px] font-black text-white">
                EPA
              </span>
              <span className="text-sm font-black text-slate-950">EPA Elearning</span>
            </div>
            <p className="mt-2 max-w-xl text-xs leading-5 text-slate-600">
              Self-paced environmental law and multilateral agreement learning resources.
            </p>
          </div>

          <LinkGroup title="Organizations" links={organizations} />
          <LinkGroup title="Treaties" links={treaties} />
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Portions copyright United Nations, FAO, UNEP, and UNESCO.</p>
          <Link href="/data-retention" className="font-semibold text-teal-700 hover:text-teal-800">
            Data retention summary
          </Link>
        </div>
      </div>
    </footer>
  );
}
