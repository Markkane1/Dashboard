"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { defaultLocale, locales, type AppLocale } from "@/shared/i18n-config";

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentLocale, setCurrentLocale] = useState<AppLocale>(defaultLocale);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      const matchedLocale = locales.find((locale) => path === `/${locale}` || path.startsWith(`/${locale}/`));
      setCurrentLocale(matchedLocale || defaultLocale);
    }
  }, [pathname]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value as AppLocale;
    const localePattern = new RegExp(`^/(${locales.join("|")})(?=/|$)`);
    const pathWithoutLocale = pathname.replace(localePattern, "") || "/";
    const nextPath = nextLocale === defaultLocale ? pathWithoutLocale : `/${nextLocale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;
    const search = typeof window !== "undefined" ? window.location.search : "";

    setCurrentLocale(nextLocale);
    router.replace(`${nextPath}${search}`);
  };

  return (
    <div className="relative inline-block min-w-0 text-left">
      <select
        aria-label={`Select language, current language is ${currentLocale === "en" ? "English" : "Urdu"}`}
        value={currentLocale}
        onChange={handleChange}
        className="block w-full max-w-[8.5rem] truncate rounded-md border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-1 cursor-pointer appearance-none sm:max-w-none"
        style={{
          backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M7 9l3 3 3-3' stroke='%25234a5568' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundPosition: "right 0.5rem center",
          backgroundSize: "1.25rem",
          backgroundRepeat: "no-repeat",
        }}
      >
        <option value="en">English (en)</option>
        <option value="ur">Urdu (ur)</option>
      </select>
    </div>
  );
}
