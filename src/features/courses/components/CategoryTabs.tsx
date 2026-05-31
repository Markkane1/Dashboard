import Link from "next/link";
import { categories as defaultCategories } from "../data/categories";

type CategoryTabsProps = {
  categories?: ReadonlyArray<{ id: string; label: string }>;
  activeCategory?: string;
  searchParams?: Record<string, string | undefined>;
};

function hrefWithParam(searchParams: Record<string, string | undefined>, key: string, value?: string) {
  const params = new URLSearchParams();
  for (const [paramKey, paramValue] of Object.entries(searchParams)) {
    if (paramValue && paramKey !== "cursor") params.set(paramKey, paramValue);
  }
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  const query = params.toString();
  return query ? `/courses?${query}` : "/courses";
}

export default function CategoryTabs({ categories = defaultCategories, activeCategory, searchParams = {} }: CategoryTabsProps) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <Link
        href={hrefWithParam(searchParams, "category")}
        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${
          !activeCategory ? "bg-forest text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
        }`}
      >
        All categories
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={hrefWithParam(searchParams, "category", category.id)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${
            activeCategory === category.id ? "bg-forest text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
          }`}
        >
          {category.label}
        </Link>
      ))}
    </div>
  );
}
